import pytest
from fastapi import HTTPException

from src.api import routes
from src.api.routes import AnalysisRequest, ThreatData, ExternalProvidersConfigRequest, ThreatIntelligenceConfigRequest
from src.services.ai_service import AIService
from src.rules.sigma_manager import SigmaRuleManager


@pytest.mark.asyncio
async def test_unavailable_services_keep_503_status():
    routes.set_services(None, None, None, None)

    with pytest.raises(HTTPException) as analysis_error:
        await routes.analyze_threat(AnalysisRequest(data={}))
    assert analysis_error.value.status_code == 503

    with pytest.raises(HTTPException) as detection_error:
        await routes.detect_anomaly(ThreatData(data={}))
    assert detection_error.value.status_code == 503


@pytest.mark.asyncio
async def test_untrained_models_use_real_baseline_detection():
    service = AIService()
    await service.initialize()

    anomaly = await service.detect_anomaly({"system": {"cpu_usage": 97}})
    malware = await service.detect_malware({"processes": [{"name": "mimikatz.exe"}]})
    network = await service.detect_network_intrusion({"network": {"connections": [{"remote_port": 4444}]}})

    assert anomaly["is_anomaly"] is True
    assert anomaly["model"] == "resource_threshold_baseline"
    assert malware["is_malware"] is True
    assert malware["model"] == "process_signature_baseline"
    assert network["is_intrusion"] is True
    assert network["model"] == "network_policy_baseline"

    await service.cleanup()


@pytest.mark.asyncio
async def test_custom_rule_reload_contract_reports_loaded_count():
    class RuleEngineStub:
        def is_healthy(self):
            return True

        async def reload_custom_rules(self):
            return 7

    routes.set_services(None, None, RuleEngineStub(), None)
    result = await routes.reload_custom_rules()
    assert result["success"] is True
    assert result["sigma_rules_loaded"] == 7


@pytest.mark.asyncio
async def test_disabled_sigma_rule_is_loaded_but_not_matched(tmp_path):
    custom_dir = tmp_path / "custom"
    custom_dir.mkdir()
    (custom_dir / "disabled.yml").write_text(
        """title: Disabled rule
enabled: false
logsource:
  product: linux
detection:
  selection:
    event: suspicious
  condition: selection
""",
        encoding="utf-8",
    )

    manager = SigmaRuleManager(str(tmp_path))
    assert await manager.load_rules(allow_download=False) == 1
    assert await manager.match_rule({"product": "linux", "event": "suspicious"}) == []


@pytest.mark.asyncio
async def test_external_provider_configuration_requires_internal_authentication():
    class ExternalAPIStub:
        def configure_providers(self, providers):
            return {name: "healthy" for name in providers}

    routes.set_services(None, None, None, ExternalAPIStub())
    request = ExternalProvidersConfigRequest(providers={"openai": {"enabled": True, "api_key": "key"}})

    with pytest.raises(HTTPException) as unauthorized:
        await routes.configure_external_apis(request, x_internal_token="wrong")
    assert unauthorized.value.status_code == 401

    result = await routes.configure_external_apis(request, x_internal_token=routes.config.internal_token)
    assert result["statuses"]["openai"] == "healthy"


@pytest.mark.asyncio
async def test_threat_intelligence_configuration_replaces_live_rule_managers():
    class RuleEngineStub:
        def is_healthy(self):
            return True

        def configure_threat_intelligence(self, misp, otx):
            assert misp["url"] == "https://misp.example"
            assert misp["api_key"] == "misp-key"
            assert otx["enabled"] is False
            return {"misp": "configured", "otx": "disabled"}

    routes.set_services(None, None, RuleEngineStub(), None)
    request = ThreatIntelligenceConfigRequest(
        misp={"enabled": True, "url": "https://misp.example", "api_key": "misp-key"},
        otx={"enabled": False, "api_key": ""}
    )

    with pytest.raises(HTTPException) as unauthorized:
        await routes.configure_threat_intelligence(request, x_internal_token="wrong")
    assert unauthorized.value.status_code == 401

    result = await routes.configure_threat_intelligence(request, x_internal_token=routes.config.internal_token)
    assert result["statuses"] == {"misp": "configured", "otx": "disabled"}

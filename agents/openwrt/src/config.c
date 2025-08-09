/**
 * TianWang OpenWrt Agent - 配置管理模块
 * 处理UCI配置文件的读取、写入和验证
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/stat.h>
#include <uci.h>

#include "agent.h"
#include "config.h"
#include "logger.h"

// UCI上下文
static struct uci_context *uci_ctx = NULL;

// 初始化UCI上下文
static int uci_init_context(void) {
    if (uci_ctx == NULL) {
        uci_ctx = uci_alloc_context();
        if (!uci_ctx) {
            log_error("Failed to allocate UCI context");
            return -1;
        }
    }
    return 0;
}

// 清理UCI上下文
static void uci_cleanup_context(void) {
    if (uci_ctx) {
        uci_free_context(uci_ctx);
        uci_ctx = NULL;
    }
}

// 获取UCI字符串值
int uci_get_string(const char *package, const char *section, const char *option, 
                   char *value, size_t value_size) {
    struct uci_package *pkg = NULL;
    struct uci_section *sec = NULL;
    struct uci_option *opt = NULL;
    struct uci_element *e;
    char path[256];
    int ret = -1;

    if (uci_init_context() < 0) {
        return -1;
    }

    snprintf(path, sizeof(path), "%s.%s.%s", package, section, option);

    if (uci_load(uci_ctx, package, &pkg) != UCI_OK) {
        log_error("Failed to load UCI package: %s", package);
        goto cleanup;
    }

    uci_foreach_element(&pkg->sections, e) {
        sec = uci_to_section(e);
        if (strcmp(sec->e.name, section) == 0) {
            break;
        }
        sec = NULL;
    }

    if (!sec) {
        log_error("UCI section not found: %s.%s", package, section);
        goto cleanup;
    }

    uci_foreach_element(&sec->options, e) {
        opt = uci_to_option(e);
        if (strcmp(opt->e.name, option) == 0) {
            break;
        }
        opt = NULL;
    }

    if (!opt) {
        log_error("UCI option not found: %s", path);
        goto cleanup;
    }

    if (opt->type == UCI_TYPE_STRING) {
        strncpy(value, opt->v.string, value_size - 1);
        value[value_size - 1] = '\0';
        ret = 0;
    } else {
        log_error("UCI option is not a string: %s", path);
    }

cleanup:
    if (pkg) {
        uci_unload(uci_ctx, pkg);
    }
    return ret;
}

// 设置UCI字符串值
int uci_set_string(const char *package, const char *section, const char *option, 
                   const char *value) {
    struct uci_ptr ptr;
    char path[256];
    int ret = -1;

    if (uci_init_context() < 0) {
        return -1;
    }

    snprintf(path, sizeof(path), "%s.%s.%s", package, section, option);

    if (uci_lookup_ptr(uci_ctx, &ptr, path, true) != UCI_OK) {
        log_error("Failed to lookup UCI path: %s", path);
        return -1;
    }

    ptr.value = value;
    if (uci_set(uci_ctx, &ptr) == UCI_OK) {
        ret = 0;
    } else {
        log_error("Failed to set UCI value: %s = %s", path, value);
    }

    return ret;
}

// 提交UCI更改
int uci_commit(const char *package) {
    struct uci_package *pkg = NULL;
    int ret = -1;

    if (uci_init_context() < 0) {
        return -1;
    }

    if (uci_load(uci_ctx, package, &pkg) != UCI_OK) {
        log_error("Failed to load UCI package for commit: %s", package);
        return -1;
    }

    if (uci_commit(uci_ctx, &pkg, false) == UCI_OK) {
        ret = 0;
        log_info("UCI package committed: %s", package);
    } else {
        log_error("Failed to commit UCI package: %s", package);
    }

    if (pkg) {
        uci_unload(uci_ctx, pkg);
    }
    return ret;
}

// 设置默认配置值
void config_set_defaults(agent_config_t *config) {
    memset(config, 0, sizeof(agent_config_t));

    // 基本配置
    strncpy(config->hostname, "openwrt-router", sizeof(config->hostname) - 1);
    strncpy(config->server_url, "ws://192.168.1.100:3001/ws", sizeof(config->server_url) - 1);
    strncpy(config->api_url, "http://192.168.1.100:3001/api", sizeof(config->api_url) - 1);
    config->server_port = 3001;

    // 认证配置
    config->auth_retry_count = 3;
    config->auth_retry_interval = 30;

    // 监控配置
    config->enable_network_monitor = 1;
    config->enable_system_monitor = 1;
    config->enable_security_service = 1;
    config->enable_websocket = 1;

    // 监控间隔
    config->network_monitor_interval = 60;
    config->system_monitor_interval = 30;
    config->heartbeat_interval = 30;

    // 数据收集配置
    config->collect_wifi_data = 1;
    config->collect_firewall_logs = 1;
    config->collect_dhcp_leases = 1;
    config->collect_bandwidth_stats = 1;

    // 安全配置
    config->enable_auto_block = 0;
    config->block_duration = 3600; // 1小时
    config->whitelist_count = 0;

    // 日志配置
    strncpy(config->log_level, "info", sizeof(config->log_level) - 1);
    strncpy(config->log_file, "/var/log/tianwang-agent.log", sizeof(config->log_file) - 1);
    config->log_max_size = 10 * 1024 * 1024; // 10MB
    config->log_rotate_count = 5;

    // WebSocket配置
    config->ws_reconnect_interval = 30;
    config->ws_max_reconnect_attempts = 10;
    config->ws_ping_interval = 30;

    // OpenWrt特定配置
    strncpy(config->uci_config_file, "tianwang-agent", sizeof(config->uci_config_file) - 1);
    strncpy(config->wireless_interface, "wlan0", sizeof(config->wireless_interface) - 1);
    strncpy(config->lan_interface, "br-lan", sizeof(config->lan_interface) - 1);
    strncpy(config->wan_interface, "eth0", sizeof(config->wan_interface) - 1);
}

// 从UCI配置文件加载配置
int config_load(agent_config_t *config, const char *config_file) {
    char value[MAX_STRING_LEN];
    char package[64];
    
    log_info("Loading configuration from %s", config_file);

    // 设置默认值
    config_set_defaults(config);

    // 从配置文件路径提取包名
    const char *pkg_name = strrchr(config_file, '/');
    if (pkg_name) {
        pkg_name++; // 跳过'/'
    } else {
        pkg_name = config_file;
    }
    strncpy(package, pkg_name, sizeof(package) - 1);
    package[sizeof(package) - 1] = '\0';

    // 检查配置文件是否存在
    if (access(config_file, R_OK) != 0) {
        log_warn("Configuration file not found: %s, using defaults", config_file);
        return 0; // 使用默认配置
    }

    // 读取基本配置
    if (uci_get_string(package, "agent", "hostname", value, sizeof(value)) == 0) {
        strncpy(config->hostname, value, sizeof(config->hostname) - 1);
    }

    if (uci_get_string(package, "agent", "server_url", value, sizeof(value)) == 0) {
        strncpy(config->server_url, value, sizeof(config->server_url) - 1);
    }

    if (uci_get_string(package, "agent", "api_url", value, sizeof(value)) == 0) {
        strncpy(config->api_url, value, sizeof(config->api_url) - 1);
    }

    if (uci_get_string(package, "agent", "server_port", value, sizeof(value)) == 0) {
        config->server_port = atoi(value);
    }

    // 读取认证配置
    if (uci_get_string(package, "auth", "token", value, sizeof(value)) == 0) {
        strncpy(config->auth_token, value, sizeof(config->auth_token) - 1);
    }

    if (uci_get_string(package, "auth", "retry_count", value, sizeof(value)) == 0) {
        config->auth_retry_count = atoi(value);
    }

    if (uci_get_string(package, "auth", "retry_interval", value, sizeof(value)) == 0) {
        config->auth_retry_interval = atoi(value);
    }

    // 读取监控配置
    if (uci_get_string(package, "monitor", "enable_network", value, sizeof(value)) == 0) {
        config->enable_network_monitor = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "monitor", "enable_system", value, sizeof(value)) == 0) {
        config->enable_system_monitor = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "monitor", "enable_security", value, sizeof(value)) == 0) {
        config->enable_security_service = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "monitor", "enable_websocket", value, sizeof(value)) == 0) {
        config->enable_websocket = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    // 读取监控间隔
    if (uci_get_string(package, "monitor", "network_interval", value, sizeof(value)) == 0) {
        config->network_monitor_interval = atoi(value);
    }

    if (uci_get_string(package, "monitor", "system_interval", value, sizeof(value)) == 0) {
        config->system_monitor_interval = atoi(value);
    }

    if (uci_get_string(package, "monitor", "heartbeat_interval", value, sizeof(value)) == 0) {
        config->heartbeat_interval = atoi(value);
    }

    // 读取数据收集配置
    if (uci_get_string(package, "collect", "wifi_data", value, sizeof(value)) == 0) {
        config->collect_wifi_data = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "collect", "firewall_logs", value, sizeof(value)) == 0) {
        config->collect_firewall_logs = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "collect", "dhcp_leases", value, sizeof(value)) == 0) {
        config->collect_dhcp_leases = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "collect", "bandwidth_stats", value, sizeof(value)) == 0) {
        config->collect_bandwidth_stats = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    // 读取安全配置
    if (uci_get_string(package, "security", "enable_auto_block", value, sizeof(value)) == 0) {
        config->enable_auto_block = strcmp(value, "1") == 0 || strcasecmp(value, "true") == 0;
    }

    if (uci_get_string(package, "security", "block_duration", value, sizeof(value)) == 0) {
        config->block_duration = atoi(value);
    }

    // 读取日志配置
    if (uci_get_string(package, "logging", "level", value, sizeof(value)) == 0) {
        strncpy(config->log_level, value, sizeof(config->log_level) - 1);
    }

    if (uci_get_string(package, "logging", "file", value, sizeof(value)) == 0) {
        strncpy(config->log_file, value, sizeof(config->log_file) - 1);
    }

    if (uci_get_string(package, "logging", "max_size", value, sizeof(value)) == 0) {
        config->log_max_size = atoi(value);
    }

    if (uci_get_string(package, "logging", "rotate_count", value, sizeof(value)) == 0) {
        config->log_rotate_count = atoi(value);
    }

    // 读取WebSocket配置
    if (uci_get_string(package, "websocket", "reconnect_interval", value, sizeof(value)) == 0) {
        config->ws_reconnect_interval = atoi(value);
    }

    if (uci_get_string(package, "websocket", "max_reconnect_attempts", value, sizeof(value)) == 0) {
        config->ws_max_reconnect_attempts = atoi(value);
    }

    if (uci_get_string(package, "websocket", "ping_interval", value, sizeof(value)) == 0) {
        config->ws_ping_interval = atoi(value);
    }

    // 读取OpenWrt特定配置
    if (uci_get_string(package, "openwrt", "wireless_interface", value, sizeof(value)) == 0) {
        strncpy(config->wireless_interface, value, sizeof(config->wireless_interface) - 1);
    }

    if (uci_get_string(package, "openwrt", "lan_interface", value, sizeof(value)) == 0) {
        strncpy(config->lan_interface, value, sizeof(config->lan_interface) - 1);
    }

    if (uci_get_string(package, "openwrt", "wan_interface", value, sizeof(value)) == 0) {
        strncpy(config->wan_interface, value, sizeof(config->wan_interface) - 1);
    }

    // 生成代理ID（基于主机名和MAC地址）
    char mac_addr[18] = {0};
    char *lan_mac = get_mac_address(config->lan_interface);
    if (lan_mac) {
        strncpy(mac_addr, lan_mac, sizeof(mac_addr) - 1);
        free(lan_mac);
    }
    
    snprintf(config->agent_id, sizeof(config->agent_id), "openwrt-%s-%s", 
             config->hostname, mac_addr);

    log_info("Configuration loaded successfully");
    return 0;
}

// 保存配置到UCI文件
int config_save(agent_config_t *config, const char *config_file) {
    char package[64];
    char value[MAX_STRING_LEN];
    
    log_info("Saving configuration to %s", config_file);

    // 从配置文件路径提取包名
    const char *pkg_name = strrchr(config_file, '/');
    if (pkg_name) {
        pkg_name++; // 跳过'/'
    } else {
        pkg_name = config_file;
    }
    strncpy(package, pkg_name, sizeof(package) - 1);
    package[sizeof(package) - 1] = '\0';

    // 保存基本配置
    uci_set_string(package, "agent", "hostname", config->hostname);
    uci_set_string(package, "agent", "server_url", config->server_url);
    uci_set_string(package, "agent", "api_url", config->api_url);
    
    snprintf(value, sizeof(value), "%d", config->server_port);
    uci_set_string(package, "agent", "server_port", value);

    // 保存认证配置
    if (strlen(config->auth_token) > 0) {
        uci_set_string(package, "auth", "token", config->auth_token);
    }
    
    snprintf(value, sizeof(value), "%d", config->auth_retry_count);
    uci_set_string(package, "auth", "retry_count", value);
    
    snprintf(value, sizeof(value), "%d", config->auth_retry_interval);
    uci_set_string(package, "auth", "retry_interval", value);

    // 保存监控配置
    uci_set_string(package, "monitor", "enable_network", config->enable_network_monitor ? "1" : "0");
    uci_set_string(package, "monitor", "enable_system", config->enable_system_monitor ? "1" : "0");
    uci_set_string(package, "monitor", "enable_security", config->enable_security_service ? "1" : "0");
    uci_set_string(package, "monitor", "enable_websocket", config->enable_websocket ? "1" : "0");

    snprintf(value, sizeof(value), "%d", config->network_monitor_interval);
    uci_set_string(package, "monitor", "network_interval", value);
    
    snprintf(value, sizeof(value), "%d", config->system_monitor_interval);
    uci_set_string(package, "monitor", "system_interval", value);
    
    snprintf(value, sizeof(value), "%d", config->heartbeat_interval);
    uci_set_string(package, "monitor", "heartbeat_interval", value);

    // 提交更改
    if (uci_commit(package) < 0) {
        log_error("Failed to commit configuration changes");
        return -1;
    }

    log_info("Configuration saved successfully");
    return 0;
}

// 验证配置
int config_validate(agent_config_t *config) {
    log_info("Validating configuration...");

    // 检查必需字段
    if (strlen(config->hostname) == 0) {
        log_error("Hostname is required");
        return -1;
    }

    if (strlen(config->server_url) == 0) {
        log_error("Server URL is required");
        return -1;
    }

    if (strlen(config->api_url) == 0) {
        log_error("API URL is required");
        return -1;
    }

    // 检查端口范围
    if (config->server_port < 1 || config->server_port > 65535) {
        log_error("Invalid server port: %d", config->server_port);
        return -1;
    }

    // 检查监控间隔
    if (config->network_monitor_interval < 10) {
        log_error("Network monitor interval too small: %d (minimum: 10)", 
                  config->network_monitor_interval);
        return -1;
    }

    if (config->system_monitor_interval < 10) {
        log_error("System monitor interval too small: %d (minimum: 10)", 
                  config->system_monitor_interval);
        return -1;
    }

    if (config->heartbeat_interval < 10) {
        log_error("Heartbeat interval too small: %d (minimum: 10)", 
                  config->heartbeat_interval);
        return -1;
    }

    // 检查日志配置
    if (config->log_max_size < 1024 * 1024) { // 最小1MB
        log_error("Log max size too small: %d (minimum: 1MB)", config->log_max_size);
        return -1;
    }

    if (config->log_rotate_count < 1) {
        log_error("Log rotate count too small: %d (minimum: 1)", config->log_rotate_count);
        return -1;
    }

    // 检查接口名称
    if (strlen(config->wireless_interface) == 0) {
        log_error("Wireless interface name is required");
        return -1;
    }

    if (strlen(config->lan_interface) == 0) {
        log_error("LAN interface name is required");
        return -1;
    }

    if (strlen(config->wan_interface) == 0) {
        log_error("WAN interface name is required");
        return -1;
    }

    log_info("Configuration validation successful");
    return 0;
}

// 打印配置信息
void config_print(agent_config_t *config) {
    printf("=== TianWang Agent Configuration ===\n");
    printf("Agent ID: %s\n", config->agent_id);
    printf("Hostname: %s\n", config->hostname);
    printf("Server URL: %s\n", config->server_url);
    printf("API URL: %s\n", config->api_url);
    printf("Server Port: %d\n", config->server_port);
    printf("\n");
    
    printf("=== Monitoring ===\n");
    printf("Network Monitor: %s (interval: %ds)\n", 
           config->enable_network_monitor ? "enabled" : "disabled",
           config->network_monitor_interval);
    printf("System Monitor: %s (interval: %ds)\n", 
           config->enable_system_monitor ? "enabled" : "disabled",
           config->system_monitor_interval);
    printf("Security Service: %s\n", 
           config->enable_security_service ? "enabled" : "disabled");
    printf("WebSocket: %s\n", 
           config->enable_websocket ? "enabled" : "disabled");
    printf("Heartbeat Interval: %ds\n", config->heartbeat_interval);
    printf("\n");
    
    printf("=== Data Collection ===\n");
    printf("WiFi Data: %s\n", config->collect_wifi_data ? "enabled" : "disabled");
    printf("Firewall Logs: %s\n", config->collect_firewall_logs ? "enabled" : "disabled");
    printf("DHCP Leases: %s\n", config->collect_dhcp_leases ? "enabled" : "disabled");
    printf("Bandwidth Stats: %s\n", config->collect_bandwidth_stats ? "enabled" : "disabled");
    printf("\n");
    
    printf("=== Security ===\n");
    printf("Auto Block: %s\n", config->enable_auto_block ? "enabled" : "disabled");
    printf("Block Duration: %ds\n", config->block_duration);
    printf("Whitelist Count: %d\n", config->whitelist_count);
    printf("\n");
    
    printf("=== Logging ===\n");
    printf("Log Level: %s\n", config->log_level);
    printf("Log File: %s\n", config->log_file);
    printf("Max Size: %d bytes\n", config->log_max_size);
    printf("Rotate Count: %d\n", config->log_rotate_count);
    printf("\n");
    
    printf("=== OpenWrt Interfaces ===\n");
    printf("Wireless: %s\n", config->wireless_interface);
    printf("LAN: %s\n", config->lan_interface);
    printf("WAN: %s\n", config->wan_interface);
    printf("=====================================\n");
}

// 清理配置模块
void config_cleanup(void) {
    uci_cleanup_context();
} 
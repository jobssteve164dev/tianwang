#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <assert.h>
#include <unistd.h>
#include <sys/stat.h>

// Include the module under test
#include "../src/agent.h"

// Test configuration file content
static const char* test_config_content = 
"package tianwang-agent\n\n"
"config agent\n"
"\toption hostname 'test-router'\n"
"\toption server_url 'ws://test.server.com:3001/ws'\n"
"\toption api_url 'http://test.server.com:3001/api'\n"
"\toption server_port '3001'\n\n"
"config auth\n"
"\toption token 'test-jwt-token'\n"
"\toption retry_count '5'\n"
"\toption retry_interval '60'\n\n"
"config monitor\n"
"\toption enable_network '1'\n"
"\toption enable_system '1'\n"
"\toption enable_security '0'\n"
"\toption enable_websocket '1'\n"
"\toption network_interval '30'\n"
"\toption system_interval '60'\n"
"\toption heartbeat_interval '45'\n\n"
"config collect\n"
"\toption wifi_data '1'\n"
"\toption firewall_logs '0'\n"
"\toption dhcp_leases '1'\n"
"\toption bandwidth_stats '1'\n\n"
"config security\n"
"\toption enable_auto_block '1'\n"
"\toption block_duration '7200'\n\n"
"config logging\n"
"\toption level 'debug'\n"
"\toption file '/tmp/tianwang-test.log'\n"
"\toption max_size '5242880'\n"
"\toption rotate_count '3'\n\n"
"config websocket\n"
"\toption reconnect_interval '45'\n"
"\toption max_reconnect_attempts '15'\n"
"\toption ping_interval '60'\n\n"
"config openwrt\n"
"\toption wireless_interface 'wlan0'\n"
"\toption lan_interface 'br-lan'\n"
"\toption wan_interface 'eth0.2'\n";

// Test helper functions
static int create_test_config_file(const char* filename) {
    FILE* fp = fopen(filename, "w");
    if (!fp) {
        return -1;
    }
    
    fprintf(fp, "%s", test_config_content);
    fclose(fp);
    return 0;
}

static void cleanup_test_file(const char* filename) {
    unlink(filename);
}

// Test cases
void test_config_set_defaults() {
    printf("Testing config_set_defaults...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Test default values
    assert(strlen(config.hostname) > 0);
    assert(strstr(config.server_url, "ws://") != NULL);
    assert(strstr(config.api_url, "http://") != NULL);
    assert(config.server_port == 3001);
    
    assert(config.auth_retry_count == 3);
    assert(config.auth_retry_interval == 30);
    
    assert(config.enable_network_monitor == 1);
    assert(config.enable_system_monitor == 1);
    assert(config.enable_security_service == 1);
    assert(config.enable_websocket == 1);
    
    assert(config.network_monitor_interval == 60);
    assert(config.system_monitor_interval == 30);
    assert(config.heartbeat_interval == 30);
    
    assert(config.collect_wifi_data == 1);
    assert(config.collect_firewall_logs == 1);
    assert(config.collect_dhcp_leases == 1);
    assert(config.collect_bandwidth_stats == 1);
    
    assert(config.enable_auto_block == 0);
    assert(config.block_duration == 3600);
    
    assert(strcmp(config.log_level, "info") == 0);
    assert(config.log_max_size == 10 * 1024 * 1024);
    assert(config.log_rotate_count == 5);
    
    assert(config.ws_reconnect_interval == 30);
    assert(config.ws_max_reconnect_attempts == 10);
    assert(config.ws_ping_interval == 30);
    
    assert(strcmp(config.wireless_interface, "wlan0") == 0);
    assert(strcmp(config.lan_interface, "br-lan") == 0);
    assert(strcmp(config.wan_interface, "eth0") == 0);
    
    printf("✓ config_set_defaults passed\n");
}

void test_config_load_success() {
    printf("Testing config_load (success case)...\n");
    
    const char* test_file = "/tmp/test_tianwang_config";
    
    // Create test config file
    assert(create_test_config_file(test_file) == 0);
    
    agent_config_t config;
    int result = config_load(&config, test_file);
    
    assert(result == 0);
    
    // Test loaded values
    assert(strcmp(config.hostname, "test-router") == 0);
    assert(strcmp(config.server_url, "ws://test.server.com:3001/ws") == 0);
    assert(strcmp(config.api_url, "http://test.server.com:3001/api") == 0);
    assert(config.server_port == 3001);
    
    assert(strcmp(config.auth_token, "test-jwt-token") == 0);
    assert(config.auth_retry_count == 5);
    assert(config.auth_retry_interval == 60);
    
    assert(config.enable_network_monitor == 1);
    assert(config.enable_system_monitor == 1);
    assert(config.enable_security_service == 0);
    assert(config.enable_websocket == 1);
    
    assert(config.network_monitor_interval == 30);
    assert(config.system_monitor_interval == 60);
    assert(config.heartbeat_interval == 45);
    
    assert(config.collect_wifi_data == 1);
    assert(config.collect_firewall_logs == 0);
    assert(config.collect_dhcp_leases == 1);
    assert(config.collect_bandwidth_stats == 1);
    
    assert(config.enable_auto_block == 1);
    assert(config.block_duration == 7200);
    
    assert(strcmp(config.log_level, "debug") == 0);
    assert(strcmp(config.log_file, "/tmp/tianwang-test.log") == 0);
    assert(config.log_max_size == 5242880);
    assert(config.log_rotate_count == 3);
    
    assert(config.ws_reconnect_interval == 45);
    assert(config.ws_max_reconnect_attempts == 15);
    assert(config.ws_ping_interval == 60);
    
    assert(strcmp(config.wireless_interface, "wlan0") == 0);
    assert(strcmp(config.lan_interface, "br-lan") == 0);
    assert(strcmp(config.wan_interface, "eth0.2") == 0);
    
    // Test agent ID generation
    assert(strlen(config.agent_id) > 0);
    assert(strstr(config.agent_id, "openwrt-") != NULL);
    
    cleanup_test_file(test_file);
    
    printf("✓ config_load (success case) passed\n");
}

void test_config_load_nonexistent_file() {
    printf("Testing config_load (nonexistent file)...\n");
    
    agent_config_t config;
    int result = config_load(&config, "/tmp/nonexistent_config_file");
    
    // Should succeed with default values
    assert(result == 0);
    
    // Should have default hostname
    assert(strcmp(config.hostname, "openwrt-router") == 0);
    
    printf("✓ config_load (nonexistent file) passed\n");
}

void test_config_validate_success() {
    printf("Testing config_validate (valid config)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    int result = config_validate(&config);
    assert(result == 0);
    
    printf("✓ config_validate (valid config) passed\n");
}

void test_config_validate_invalid_hostname() {
    printf("Testing config_validate (invalid hostname)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Set invalid hostname
    strcpy(config.hostname, "");
    
    int result = config_validate(&config);
    assert(result == -1);
    
    printf("✓ config_validate (invalid hostname) passed\n");
}

void test_config_validate_invalid_urls() {
    printf("Testing config_validate (invalid URLs)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Test invalid server URL
    strcpy(config.server_url, "");
    int result = config_validate(&config);
    assert(result == -1);
    
    // Reset and test invalid API URL
    config_set_defaults(&config);
    strcpy(config.api_url, "");
    result = config_validate(&config);
    assert(result == -1);
    
    printf("✓ config_validate (invalid URLs) passed\n");
}

void test_config_validate_invalid_port() {
    printf("Testing config_validate (invalid port)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Test invalid port (too low)
    config.server_port = 0;
    int result = config_validate(&config);
    assert(result == -1);
    
    // Test invalid port (too high)
    config.server_port = 70000;
    result = config_validate(&config);
    assert(result == -1);
    
    printf("✓ config_validate (invalid port) passed\n");
}

void test_config_validate_invalid_intervals() {
    printf("Testing config_validate (invalid intervals)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Test invalid network monitor interval
    config.network_monitor_interval = 5;
    int result = config_validate(&config);
    assert(result == -1);
    
    // Reset and test invalid system monitor interval
    config_set_defaults(&config);
    config.system_monitor_interval = 5;
    result = config_validate(&config);
    assert(result == -1);
    
    // Reset and test invalid heartbeat interval
    config_set_defaults(&config);
    config.heartbeat_interval = 5;
    result = config_validate(&config);
    assert(result == -1);
    
    printf("✓ config_validate (invalid intervals) passed\n");
}

void test_config_validate_invalid_log_config() {
    printf("Testing config_validate (invalid log config)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Test invalid log max size
    config.log_max_size = 1000; // Less than 1MB
    int result = config_validate(&config);
    assert(result == -1);
    
    // Reset and test invalid log rotate count
    config_set_defaults(&config);
    config.log_rotate_count = 0;
    result = config_validate(&config);
    assert(result == -1);
    
    printf("✓ config_validate (invalid log config) passed\n");
}

void test_config_validate_invalid_interfaces() {
    printf("Testing config_validate (invalid interfaces)...\n");
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Test invalid wireless interface
    strcpy(config.wireless_interface, "");
    int result = config_validate(&config);
    assert(result == -1);
    
    // Reset and test invalid LAN interface
    config_set_defaults(&config);
    strcpy(config.lan_interface, "");
    result = config_validate(&config);
    assert(result == -1);
    
    // Reset and test invalid WAN interface
    config_set_defaults(&config);
    strcpy(config.wan_interface, "");
    result = config_validate(&config);
    assert(result == -1);
    
    printf("✓ config_validate (invalid interfaces) passed\n");
}

void test_config_save() {
    printf("Testing config_save...\n");
    
    const char* test_file = "/tmp/test_tianwang_config_save";
    
    agent_config_t config;
    config_set_defaults(&config);
    
    // Modify some values
    strcpy(config.hostname, "test-save-router");
    config.server_port = 4001;
    config.enable_network_monitor = 0;
    
    int result = config_save(&config, test_file);
    assert(result == 0);
    
    // Verify file was created
    struct stat st;
    assert(stat(test_file, &st) == 0);
    
    cleanup_test_file(test_file);
    
    printf("✓ config_save passed\n");
}

// Main test runner
int main() {
    printf("Running OpenWrt Agent Config Tests\n");
    printf("==================================\n\n");
    
    // Run all tests
    test_config_set_defaults();
    test_config_load_success();
    test_config_load_nonexistent_file();
    test_config_validate_success();
    test_config_validate_invalid_hostname();
    test_config_validate_invalid_urls();
    test_config_validate_invalid_port();
    test_config_validate_invalid_intervals();
    test_config_validate_invalid_log_config();
    test_config_validate_invalid_interfaces();
    test_config_save();
    
    printf("\n==================================\n");
    printf("All tests passed! ✓\n");
    
    return 0;
} 
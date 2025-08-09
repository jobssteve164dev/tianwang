/**
 * TianWang OpenWrt Agent - 主头文件
 * 定义核心结构体和函数声明
 */

#ifndef AGENT_H
#define AGENT_H

#include <stdint.h>
#include <time.h>

#define AGENT_VERSION "1.0.0"
#define AGENT_NAME "tianwang-agent"
#define MAX_STRING_LEN 256
#define MAX_BUFFER_SIZE 4096

// 代理配置结构体
typedef struct {
    // 基本配置
    char agent_id[MAX_STRING_LEN];
    char hostname[MAX_STRING_LEN];
    char server_url[MAX_STRING_LEN];
    char api_url[MAX_STRING_LEN];
    int server_port;
    
    // 认证配置
    char auth_token[MAX_STRING_LEN];
    int auth_retry_count;
    int auth_retry_interval;
    
    // 监控配置
    int enable_network_monitor;
    int enable_system_monitor;
    int enable_security_service;
    int enable_websocket;
    
    // 监控间隔（秒）
    int network_monitor_interval;
    int system_monitor_interval;
    int heartbeat_interval;
    
    // 数据收集配置
    int collect_wifi_data;
    int collect_firewall_logs;
    int collect_dhcp_leases;
    int collect_bandwidth_stats;
    
    // 安全配置
    int enable_auto_block;
    int block_duration;
    char whitelist_ips[10][MAX_STRING_LEN];
    int whitelist_count;
    
    // 日志配置
    char log_level[16];
    char log_file[MAX_STRING_LEN];
    int log_max_size;
    int log_rotate_count;
    
    // WebSocket配置
    int ws_reconnect_interval;
    int ws_max_reconnect_attempts;
    int ws_ping_interval;
    
    // OpenWrt特定配置
    char uci_config_file[MAX_STRING_LEN];
    char wireless_interface[32];
    char lan_interface[32];
    char wan_interface[32];
} agent_config_t;

// 网络接口信息
typedef struct {
    char name[32];
    char type[16];
    char status[16];
    char ip_address[64];
    char mac_address[18];
    uint64_t rx_bytes;
    uint64_t tx_bytes;
    uint32_t rx_packets;
    uint32_t tx_packets;
    uint32_t rx_errors;
    uint32_t tx_errors;
} network_interface_t;

// WiFi设备信息
typedef struct {
    char mac_address[18];
    char hostname[MAX_STRING_LEN];
    char ip_address[64];
    int signal_strength;
    int connected_time;
    uint64_t rx_bytes;
    uint64_t tx_bytes;
    char encryption[32];
    int is_authorized;
} wifi_device_t;

// 系统信息
typedef struct {
    char kernel_version[MAX_STRING_LEN];
    char openwrt_version[MAX_STRING_LEN];
    int uptime;
    int load_average[3];
    int memory_total;
    int memory_free;
    int memory_available;
    int cpu_usage;
    int temperature;
} system_info_t;

// 防火墙规则
typedef struct {
    char chain[32];
    char target[32];
    char protocol[16];
    char source[64];
    char destination[64];
    int source_port;
    int dest_port;
    char interface[32];
    int packet_count;
    int byte_count;
} firewall_rule_t;

// 安全事件
typedef struct {
    time_t timestamp;
    char type[64];
    char severity[16];
    char source_ip[64];
    char description[MAX_STRING_LEN];
    char action_taken[MAX_STRING_LEN];
} security_event_t;

// 代理状态
typedef struct {
    int is_running;
    int is_connected;
    time_t start_time;
    time_t last_heartbeat;
    int reconnect_count;
    int data_sent_count;
    int errors_count;
} agent_status_t;

// 函数声明

// 代理核心函数
int agent_init(agent_config_t *config);
void agent_cleanup(void);
int agent_start(void);
void agent_stop(void);
agent_status_t *agent_get_status(void);

// 配置管理
int config_load(agent_config_t *config, const char *config_file);
int config_save(agent_config_t *config, const char *config_file);
int config_validate(agent_config_t *config);
void config_print(agent_config_t *config);
void config_set_defaults(agent_config_t *config);

// 网络监控
int network_monitor_init(agent_config_t *config);
void network_monitor_cleanup(void);
int network_monitor_collect_data(void);
int network_monitor_get_interfaces(network_interface_t **interfaces, int *count);
int network_monitor_get_wifi_devices(wifi_device_t **devices, int *count);
int network_monitor_get_bandwidth_stats(void);

// 系统监控
int system_monitor_init(agent_config_t *config);
void system_monitor_cleanup(void);
int system_monitor_collect_data(void);
int system_monitor_get_system_info(system_info_t *info);
int system_monitor_get_process_list(void);

// 安全服务
int security_service_init(agent_config_t *config);
void security_service_cleanup(void);
int security_service_process(void);
int security_service_block_ip(const char *ip, const char *reason);
int security_service_unblock_ip(const char *ip);
int security_service_get_firewall_rules(firewall_rule_t **rules, int *count);
int security_service_add_firewall_rule(firewall_rule_t *rule);
int security_service_remove_firewall_rule(int rule_id);

// WebSocket客户端
int websocket_client_connect(agent_config_t *config);
void websocket_client_disconnect(void);
int websocket_client_send_data(const char *type, const void *data, size_t data_size);
int websocket_client_run(void);
int websocket_client_is_connected(void);

// 日志系统
int logger_init(const char *log_level, int daemon_mode);
void logger_cleanup(void);
void log_debug(const char *format, ...);
void log_info(const char *format, ...);
void log_warn(const char *format, ...);
void log_error(const char *format, ...);

// 工具函数
char *get_mac_address(const char *interface);
char *get_ip_address(const char *interface);
int execute_command(const char *command, char *output, size_t output_size);
int is_valid_ip(const char *ip);
int is_valid_mac(const char *mac);
time_t get_current_time(void);
char *format_time(time_t time);
int create_directory(const char *path);
int file_exists(const char *path);
long get_file_size(const char *path);

// UCI配置接口
int uci_get_string(const char *package, const char *section, const char *option, char *value, size_t value_size);
int uci_set_string(const char *package, const char *section, const char *option, const char *value);
int uci_get_list(const char *package, const char *section, const char *option, char ***list, int *count);
int uci_commit(const char *package);

// JSON处理
char *json_create_system_data(system_info_t *info);
char *json_create_network_data(network_interface_t *interfaces, int interface_count, 
                               wifi_device_t *devices, int device_count);
char *json_create_security_event(security_event_t *event);
int json_parse_server_response(const char *json_data);

// 错误代码
#define AGENT_SUCCESS           0
#define AGENT_ERROR_GENERIC    -1
#define AGENT_ERROR_CONFIG     -2
#define AGENT_ERROR_NETWORK    -3
#define AGENT_ERROR_AUTH       -4
#define AGENT_ERROR_MEMORY     -5
#define AGENT_ERROR_FILE       -6
#define AGENT_ERROR_PERMISSION -7
#define AGENT_ERROR_TIMEOUT    -8

#endif // AGENT_H 
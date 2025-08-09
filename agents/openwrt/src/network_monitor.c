/**
 * TianWang OpenWrt Agent - 网络监控模块
 * 收集网络接口状态、WiFi设备信息和流量统计
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <sys/ioctl.h>
#include <net/if.h>
#include <arpa/inet.h>
#include <dirent.h>

#include "agent.h"
#include "network_monitor.h"
#include "logger.h"

// 全局变量
static agent_config_t *g_config = NULL;
static network_interface_t *g_interfaces = NULL;
static int g_interface_count = 0;
static wifi_device_t *g_wifi_devices = NULL;
static int g_wifi_device_count = 0;

// 初始化网络监控
int network_monitor_init(agent_config_t *config) {
    if (!config) {
        log_error("Invalid config parameter");
        return AGENT_ERROR_CONFIG;
    }

    g_config = config;
    
    log_info("Network monitor initialized");
    return AGENT_SUCCESS;
}

// 清理网络监控
void network_monitor_cleanup(void) {
    if (g_interfaces) {
        free(g_interfaces);
        g_interfaces = NULL;
        g_interface_count = 0;
    }

    if (g_wifi_devices) {
        free(g_wifi_devices);
        g_wifi_devices = NULL;
        g_wifi_device_count = 0;
    }

    log_info("Network monitor cleaned up");
}

// 读取网络接口统计信息
static int read_interface_stats(const char *interface, network_interface_t *iface) {
    FILE *fp;
    char line[512];
    char path[256];
    
    // 读取接口统计信息
    snprintf(path, sizeof(path), "/sys/class/net/%s/statistics/rx_bytes", interface);
    fp = fopen(path, "r");
    if (fp) {
        if (fgets(line, sizeof(line), fp)) {
            iface->rx_bytes = strtoull(line, NULL, 10);
        }
        fclose(fp);
    }

    snprintf(path, sizeof(path), "/sys/class/net/%s/statistics/tx_bytes", interface);
    fp = fopen(path, "r");
    if (fp) {
        if (fgets(line, sizeof(line), fp)) {
            iface->tx_bytes = strtoull(line, NULL, 10);
        }
        fclose(fp);
    }

    snprintf(path, sizeof(path), "/sys/class/net/%s/statistics/rx_packets", interface);
    fp = fopen(path, "r");
    if (fp) {
        if (fgets(line, sizeof(line), fp)) {
            iface->rx_packets = strtoul(line, NULL, 10);
        }
        fclose(fp);
    }

    snprintf(path, sizeof(path), "/sys/class/net/%s/statistics/tx_packets", interface);
    fp = fopen(path, "r");
    if (fp) {
        if (fgets(line, sizeof(line), fp)) {
            iface->tx_packets = strtoul(line, NULL, 10);
        }
        fclose(fp);
    }

    snprintf(path, sizeof(path), "/sys/class/net/%s/statistics/rx_errors", interface);
    fp = fopen(path, "r");
    if (fp) {
        if (fgets(line, sizeof(line), fp)) {
            iface->rx_errors = strtoul(line, NULL, 10);
        }
        fclose(fp);
    }

    snprintf(path, sizeof(path), "/sys/class/net/%s/statistics/tx_errors", interface);
    fp = fopen(path, "r");
    if (fp) {
        if (fgets(line, sizeof(line), fp)) {
            iface->tx_errors = strtoul(line, NULL, 10);
        }
        fclose(fp);
    }

    return 0;
}

// 获取接口状态
static int get_interface_status(const char *interface, char *status, size_t status_size) {
    char path[256];
    FILE *fp;
    char line[64];

    snprintf(path, sizeof(path), "/sys/class/net/%s/operstate", interface);
    fp = fopen(path, "r");
    if (!fp) {
        strncpy(status, "unknown", status_size - 1);
        status[status_size - 1] = '\0';
        return -1;
    }

    if (fgets(line, sizeof(line), fp)) {
        // 移除换行符
        char *newline = strchr(line, '\n');
        if (newline) {
            *newline = '\0';
        }
        strncpy(status, line, status_size - 1);
        status[status_size - 1] = '\0';
    } else {
        strncpy(status, "unknown", status_size - 1);
        status[status_size - 1] = '\0';
    }

    fclose(fp);
    return 0;
}

// 判断接口类型
static void get_interface_type(const char *interface, char *type, size_t type_size) {
    if (strncmp(interface, "wlan", 4) == 0 || strncmp(interface, "ath", 3) == 0) {
        strncpy(type, "wireless", type_size - 1);
    } else if (strncmp(interface, "eth", 3) == 0) {
        strncpy(type, "ethernet", type_size - 1);
    } else if (strncmp(interface, "br-", 3) == 0) {
        strncpy(type, "bridge", type_size - 1);
    } else if (strcmp(interface, "lo") == 0) {
        strncpy(type, "loopback", type_size - 1);
    } else {
        strncpy(type, "other", type_size - 1);
    }
    type[type_size - 1] = '\0';
}

// 获取网络接口列表
int network_monitor_get_interfaces(network_interface_t **interfaces, int *count) {
    DIR *dir;
    struct dirent *entry;
    network_interface_t *iface_list = NULL;
    int iface_count = 0;
    int capacity = 10;

    *interfaces = NULL;
    *count = 0;

    // 分配初始内存
    iface_list = malloc(capacity * sizeof(network_interface_t));
    if (!iface_list) {
        log_error("Failed to allocate memory for interface list");
        return AGENT_ERROR_MEMORY;
    }

    // 扫描网络接口目录
    dir = opendir("/sys/class/net");
    if (!dir) {
        log_error("Failed to open /sys/class/net directory");
        free(iface_list);
        return AGENT_ERROR_FILE;
    }

    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_name[0] == '.') {
            continue; // 跳过隐藏文件
        }

        // 扩展数组容量
        if (iface_count >= capacity) {
            capacity *= 2;
            network_interface_t *new_list = realloc(iface_list, capacity * sizeof(network_interface_t));
            if (!new_list) {
                log_error("Failed to reallocate memory for interface list");
                free(iface_list);
                closedir(dir);
                return AGENT_ERROR_MEMORY;
            }
            iface_list = new_list;
        }

        network_interface_t *iface = &iface_list[iface_count];
        memset(iface, 0, sizeof(network_interface_t));

        // 设置接口名称
        strncpy(iface->name, entry->d_name, sizeof(iface->name) - 1);

        // 获取接口类型
        get_interface_type(entry->d_name, iface->type, sizeof(iface->type));

        // 获取接口状态
        get_interface_status(entry->d_name, iface->status, sizeof(iface->status));

        // 获取IP地址
        char *ip = get_ip_address(entry->d_name);
        if (ip) {
            strncpy(iface->ip_address, ip, sizeof(iface->ip_address) - 1);
            free(ip);
        }

        // 获取MAC地址
        char *mac = get_mac_address(entry->d_name);
        if (mac) {
            strncpy(iface->mac_address, mac, sizeof(iface->mac_address) - 1);
            free(mac);
        }

        // 读取统计信息
        read_interface_stats(entry->d_name, iface);

        iface_count++;
    }

    closedir(dir);

    *interfaces = iface_list;
    *count = iface_count;

    log_debug("Found %d network interfaces", iface_count);
    return AGENT_SUCCESS;
}

// 解析WiFi设备信息（从hostapd或iwinfo）
static int parse_wifi_devices_from_iwinfo(wifi_device_t **devices, int *count) {
    char command[256];
    FILE *fp;
    char line[512];
    wifi_device_t *device_list = NULL;
    int device_count = 0;
    int capacity = 20;

    *devices = NULL;
    *count = 0;

    // 分配初始内存
    device_list = malloc(capacity * sizeof(wifi_device_t));
    if (!device_list) {
        log_error("Failed to allocate memory for WiFi device list");
        return AGENT_ERROR_MEMORY;
    }

    // 使用iwinfo获取WiFi设备信息
    snprintf(command, sizeof(command), "iwinfo %s assoclist", g_config->wireless_interface);
    fp = popen(command, "r");
    if (!fp) {
        log_error("Failed to execute iwinfo command");
        free(device_list);
        return AGENT_ERROR_GENERIC;
    }

    while (fgets(line, sizeof(line), fp)) {
        // 解析MAC地址行（格式：AA:BB:CC:DD:EE:FF  signal: -XX dBm）
        if (strstr(line, ":") && strstr(line, "signal:")) {
            if (device_count >= capacity) {
                capacity *= 2;
                wifi_device_t *new_list = realloc(device_list, capacity * sizeof(wifi_device_t));
                if (!new_list) {
                    log_error("Failed to reallocate memory for WiFi device list");
                    free(device_list);
                    pclose(fp);
                    return AGENT_ERROR_MEMORY;
                }
                device_list = new_list;
            }

            wifi_device_t *device = &device_list[device_count];
            memset(device, 0, sizeof(wifi_device_t));

            // 解析MAC地址
            char *mac_start = line;
            char *mac_end = strstr(line, "  ");
            if (mac_end) {
                size_t mac_len = mac_end - mac_start;
                if (mac_len < sizeof(device->mac_address)) {
                    strncpy(device->mac_address, mac_start, mac_len);
                    device->mac_address[mac_len] = '\0';
                }
            }

            // 解析信号强度
            char *signal_start = strstr(line, "signal:");
            if (signal_start) {
                signal_start += 7; // 跳过"signal:"
                device->signal_strength = atoi(signal_start);
            }

            // 设置默认值
            device->is_authorized = 1;
            device->connected_time = 0; // 需要其他方法获取
            strncpy(device->encryption, "WPA2", sizeof(device->encryption) - 1);

            device_count++;
        }
    }

    pclose(fp);

    *devices = device_list;
    *count = device_count;

    log_debug("Found %d WiFi devices", device_count);
    return AGENT_SUCCESS;
}

// 获取WiFi设备列表
int network_monitor_get_wifi_devices(wifi_device_t **devices, int *count) {
    if (!g_config || !g_config->collect_wifi_data) {
        *devices = NULL;
        *count = 0;
        return AGENT_SUCCESS;
    }

    return parse_wifi_devices_from_iwinfo(devices, count);
}

// 获取带宽统计信息
int network_monitor_get_bandwidth_stats(void) {
    if (!g_config || !g_config->collect_bandwidth_stats) {
        return AGENT_SUCCESS;
    }

    // 这里可以实现更详细的带宽统计
    // 例如：读取/proc/net/dev，计算速率等
    
    log_debug("Bandwidth statistics collected");
    return AGENT_SUCCESS;
}

// 收集网络数据
int network_monitor_collect_data(void) {
    int ret = AGENT_SUCCESS;

    log_debug("Collecting network monitoring data...");

    // 清理之前的数据
    if (g_interfaces) {
        free(g_interfaces);
        g_interfaces = NULL;
        g_interface_count = 0;
    }

    if (g_wifi_devices) {
        free(g_wifi_devices);
        g_wifi_devices = NULL;
        g_wifi_device_count = 0;
    }

    // 收集网络接口信息
    ret = network_monitor_get_interfaces(&g_interfaces, &g_interface_count);
    if (ret != AGENT_SUCCESS) {
        log_error("Failed to collect network interface data");
        return ret;
    }

    // 收集WiFi设备信息
    ret = network_monitor_get_wifi_devices(&g_wifi_devices, &g_wifi_device_count);
    if (ret != AGENT_SUCCESS) {
        log_error("Failed to collect WiFi device data");
        return ret;
    }

    // 收集带宽统计
    ret = network_monitor_get_bandwidth_stats();
    if (ret != AGENT_SUCCESS) {
        log_error("Failed to collect bandwidth statistics");
        return ret;
    }

    // 创建JSON数据并发送到服务器
    char *json_data = json_create_network_data(g_interfaces, g_interface_count,
                                               g_wifi_devices, g_wifi_device_count);
    if (json_data) {
        // 通过WebSocket发送数据
        if (websocket_client_is_connected()) {
            websocket_client_send_data("network", json_data, strlen(json_data));
        }
        free(json_data);
    }

    log_debug("Network monitoring data collection completed");
    return AGENT_SUCCESS;
} 
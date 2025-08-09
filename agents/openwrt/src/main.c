/**
 * TianWang OpenWrt Agent - 主程序
 * 天网安全监控系统 - OpenWrt代理程序
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <errno.h>
#include <getopt.h>
#include <sys/types.h>
#include <sys/stat.h>
#include <syslog.h>
#include <pthread.h>

#include "agent.h"
#include "config.h"
#include "logger.h"
#include "network_monitor.h"
#include "system_monitor.h"
#include "security_service.h"
#include "websocket_client.h"

// 全局变量
static volatile int g_running = 1;
static agent_config_t g_config;
static pthread_t monitor_threads[4];
static int daemon_mode = 0;

// 信号处理函数
void signal_handler(int sig) {
    switch (sig) {
        case SIGTERM:
        case SIGINT:
            log_info("Received signal %d, shutting down gracefully...", sig);
            g_running = 0;
            break;
        case SIGHUP:
            log_info("Received SIGHUP, reloading configuration...");
            // TODO: 重新加载配置
            break;
        default:
            log_warn("Received unexpected signal: %d", sig);
            break;
    }
}

// 设置信号处理
void setup_signals(void) {
    struct sigaction sa;
    
    // 设置信号处理函数
    sa.sa_handler = signal_handler;
    sigemptyset(&sa.sa_mask);
    sa.sa_flags = 0;
    
    sigaction(SIGTERM, &sa, NULL);
    sigaction(SIGINT, &sa, NULL);
    sigaction(SIGHUP, &sa, NULL);
    
    // 忽略SIGPIPE
    signal(SIGPIPE, SIG_IGN);
}

// 守护进程化
int daemonize(void) {
    pid_t pid;
    
    // 第一次fork
    pid = fork();
    if (pid < 0) {
        log_error("First fork failed: %s", strerror(errno));
        return -1;
    }
    if (pid > 0) {
        exit(0); // 父进程退出
    }
    
    // 创建新的会话
    if (setsid() < 0) {
        log_error("setsid failed: %s", strerror(errno));
        return -1;
    }
    
    // 第二次fork
    pid = fork();
    if (pid < 0) {
        log_error("Second fork failed: %s", strerror(errno));
        return -1;
    }
    if (pid > 0) {
        exit(0); // 父进程退出
    }
    
    // 改变工作目录
    if (chdir("/") < 0) {
        log_error("chdir failed: %s", strerror(errno));
        return -1;
    }
    
    // 设置文件权限掩码
    umask(0);
    
    // 关闭文件描述符
    close(STDIN_FILENO);
    close(STDOUT_FILENO);
    close(STDERR_FILENO);
    
    // 重定向标准输入输出到/dev/null
    open("/dev/null", O_RDONLY); // stdin
    open("/dev/null", O_WRONLY); // stdout
    open("/dev/null", O_WRONLY); // stderr
    
    return 0;
}

// 创建PID文件
int create_pidfile(const char *pidfile_path) {
    FILE *pidfile;
    pid_t pid = getpid();
    
    pidfile = fopen(pidfile_path, "w");
    if (!pidfile) {
        log_error("Cannot create PID file %s: %s", pidfile_path, strerror(errno));
        return -1;
    }
    
    fprintf(pidfile, "%d\n", pid);
    fclose(pidfile);
    
    log_info("PID file created: %s (PID: %d)", pidfile_path, pid);
    return 0;
}

// 网络监控线程
void *network_monitor_thread(void *arg) {
    agent_config_t *config = (agent_config_t *)arg;
    
    log_info("Network monitor thread started");
    
    if (network_monitor_init(config) < 0) {
        log_error("Failed to initialize network monitor");
        return NULL;
    }
    
    while (g_running) {
        if (network_monitor_collect_data() < 0) {
            log_error("Network monitor data collection failed");
        }
        sleep(config->network_monitor_interval);
    }
    
    network_monitor_cleanup();
    log_info("Network monitor thread stopped");
    return NULL;
}

// 系统监控线程
void *system_monitor_thread(void *arg) {
    agent_config_t *config = (agent_config_t *)arg;
    
    log_info("System monitor thread started");
    
    if (system_monitor_init(config) < 0) {
        log_error("Failed to initialize system monitor");
        return NULL;
    }
    
    while (g_running) {
        if (system_monitor_collect_data() < 0) {
            log_error("System monitor data collection failed");
        }
        sleep(config->system_monitor_interval);
    }
    
    system_monitor_cleanup();
    log_info("System monitor thread stopped");
    return NULL;
}

// 安全服务线程
void *security_service_thread(void *arg) {
    agent_config_t *config = (agent_config_t *)arg;
    
    log_info("Security service thread started");
    
    if (security_service_init(config) < 0) {
        log_error("Failed to initialize security service");
        return NULL;
    }
    
    while (g_running) {
        if (security_service_process() < 0) {
            log_error("Security service processing failed");
        }
        sleep(1); // 安全服务需要更频繁的检查
    }
    
    security_service_cleanup();
    log_info("Security service thread stopped");
    return NULL;
}

// WebSocket客户端线程
void *websocket_client_thread(void *arg) {
    agent_config_t *config = (agent_config_t *)arg;
    
    log_info("WebSocket client thread started");
    
    while (g_running) {
        if (websocket_client_connect(config) < 0) {
            log_error("WebSocket connection failed, retrying in 30 seconds...");
            sleep(30);
            continue;
        }
        
        // 保持连接和处理消息
        websocket_client_run();
        
        if (g_running) {
            log_warn("WebSocket connection lost, reconnecting in 10 seconds...");
            sleep(10);
        }
    }
    
    websocket_client_disconnect();
    log_info("WebSocket client thread stopped");
    return NULL;
}

// 启动所有监控线程
int start_monitor_threads(agent_config_t *config) {
    int ret = 0;
    
    // 网络监控线程
    if (config->enable_network_monitor) {
        ret = pthread_create(&monitor_threads[0], NULL, network_monitor_thread, config);
        if (ret != 0) {
            log_error("Failed to create network monitor thread: %s", strerror(ret));
            return -1;
        }
    }
    
    // 系统监控线程
    if (config->enable_system_monitor) {
        ret = pthread_create(&monitor_threads[1], NULL, system_monitor_thread, config);
        if (ret != 0) {
            log_error("Failed to create system monitor thread: %s", strerror(ret));
            return -1;
        }
    }
    
    // 安全服务线程
    if (config->enable_security_service) {
        ret = pthread_create(&monitor_threads[2], NULL, security_service_thread, config);
        if (ret != 0) {
            log_error("Failed to create security service thread: %s", strerror(ret));
            return -1;
        }
    }
    
    // WebSocket客户端线程
    if (config->enable_websocket) {
        ret = pthread_create(&monitor_threads[3], NULL, websocket_client_thread, config);
        if (ret != 0) {
            log_error("Failed to create WebSocket client thread: %s", strerror(ret));
            return -1;
        }
    }
    
    return 0;
}

// 等待所有线程结束
void wait_for_threads(void) {
    for (int i = 0; i < 4; i++) {
        if (monitor_threads[i] != 0) {
            pthread_join(monitor_threads[i], NULL);
        }
    }
}

// 显示帮助信息
void show_help(const char *program_name) {
    printf("Usage: %s [OPTIONS]\n", program_name);
    printf("\n");
    printf("TianWang OpenWrt Agent - AI-driven security monitoring system\n");
    printf("\n");
    printf("Options:\n");
    printf("  -c, --config FILE     Configuration file path (default: /etc/config/tianwang-agent)\n");
    printf("  -d, --daemon          Run as daemon\n");
    printf("  -p, --pidfile FILE    PID file path (default: /var/run/tianwang-agent.pid)\n");
    printf("  -l, --loglevel LEVEL  Log level (debug, info, warn, error)\n");
    printf("  -t, --test            Test configuration and exit\n");
    printf("  -v, --version         Show version information\n");
    printf("  -h, --help            Show this help message\n");
    printf("\n");
    printf("Examples:\n");
    printf("  %s -d                 Run as daemon with default config\n", program_name);
    printf("  %s -c /tmp/config     Use custom configuration file\n", program_name);
    printf("  %s -t                 Test configuration\n", program_name);
    printf("\n");
}

// 显示版本信息
void show_version(void) {
    printf("TianWang OpenWrt Agent v%s\n", AGENT_VERSION);
    printf("Built on %s %s\n", __DATE__, __TIME__);
    printf("Copyright (C) 2024 TianWang Security Team\n");
}

// 主函数
int main(int argc, char *argv[]) {
    int opt;
    char *config_file = "/etc/config/tianwang-agent";
    char *pidfile_path = "/var/run/tianwang-agent.pid";
    char *log_level = "info";
    int test_config = 0;
    
    // 长选项定义
    static struct option long_options[] = {
        {"config",   required_argument, 0, 'c'},
        {"daemon",   no_argument,       0, 'd'},
        {"pidfile",  required_argument, 0, 'p'},
        {"loglevel", required_argument, 0, 'l'},
        {"test",     no_argument,       0, 't'},
        {"version",  no_argument,       0, 'v'},
        {"help",     no_argument,       0, 'h'},
        {0, 0, 0, 0}
    };
    
    // 解析命令行参数
    while ((opt = getopt_long(argc, argv, "c:dp:l:tvh", long_options, NULL)) != -1) {
        switch (opt) {
            case 'c':
                config_file = optarg;
                break;
            case 'd':
                daemon_mode = 1;
                break;
            case 'p':
                pidfile_path = optarg;
                break;
            case 'l':
                log_level = optarg;
                break;
            case 't':
                test_config = 1;
                break;
            case 'v':
                show_version();
                exit(0);
            case 'h':
                show_help(argv[0]);
                exit(0);
            default:
                show_help(argv[0]);
                exit(1);
        }
    }
    
    // 初始化日志系统
    if (logger_init(log_level, daemon_mode) < 0) {
        fprintf(stderr, "Failed to initialize logger\n");
        exit(1);
    }
    
    log_info("TianWang OpenWrt Agent v%s starting...", AGENT_VERSION);
    
    // 加载配置
    if (config_load(&g_config, config_file) < 0) {
        log_error("Failed to load configuration from %s", config_file);
        exit(1);
    }
    
    // 测试配置模式
    if (test_config) {
        log_info("Configuration test successful");
        config_print(&g_config);
        exit(0);
    }
    
    // 验证配置
    if (config_validate(&g_config) < 0) {
        log_error("Configuration validation failed");
        exit(1);
    }
    
    // 守护进程模式
    if (daemon_mode) {
        log_info("Starting in daemon mode...");
        if (daemonize() < 0) {
            log_error("Failed to daemonize");
            exit(1);
        }
        
        // 创建PID文件
        if (create_pidfile(pidfile_path) < 0) {
            exit(1);
        }
    }
    
    // 设置信号处理
    setup_signals();
    
    // 初始化代理
    if (agent_init(&g_config) < 0) {
        log_error("Failed to initialize agent");
        exit(1);
    }
    
    // 启动监控线程
    if (start_monitor_threads(&g_config) < 0) {
        log_error("Failed to start monitor threads");
        agent_cleanup();
        exit(1);
    }
    
    log_info("TianWang OpenWrt Agent started successfully");
    
    // 主循环
    while (g_running) {
        // 检查系统状态
        sleep(5);
        
        // 这里可以添加主线程的周期性任务
        // 例如：状态检查、配置重新加载等
    }
    
    log_info("Shutting down TianWang OpenWrt Agent...");
    
    // 等待所有线程结束
    wait_for_threads();
    
    // 清理资源
    agent_cleanup();
    
    // 删除PID文件
    if (daemon_mode) {
        unlink(pidfile_path);
    }
    
    // 关闭日志系统
    logger_cleanup();
    
    log_info("TianWang OpenWrt Agent stopped");
    
    return 0;
} 
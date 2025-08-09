# TianWang OpenWrt Agent Makefile

# 编译器和标志
CC = gcc
CXX = g++
CFLAGS = -Wall -Wextra -std=c11 -O2 -D_GNU_SOURCE
CXXFLAGS = -Wall -Wextra -std=c++17 -O2
LDFLAGS = -luci -ljson-c -lcurl -lpthread -lssl -lcrypto

# 目录
SRCDIR = src
BUILDDIR = build
BINDIR = bin
TESTDIR = tests

# 源文件
SOURCES = $(wildcard $(SRCDIR)/*.c)
OBJECTS = $(SOURCES:$(SRCDIR)/%.c=$(BUILDDIR)/%.o)
TARGET = $(BINDIR)/tianwang-agent

# 默认目标
all: $(TARGET)

# 创建目录
$(BUILDDIR):
	mkdir -p $(BUILDDIR)

$(BINDIR):
	mkdir -p $(BINDIR)

# 编译目标文件
$(BUILDDIR)/%.o: $(SRCDIR)/%.c | $(BUILDDIR)
	$(CC) $(CFLAGS) -c $< -o $@

# 链接可执行文件
$(TARGET): $(OBJECTS) | $(BINDIR)
	$(CC) $(OBJECTS) $(LDFLAGS) -o $@

# 安装到OpenWrt系统
install: $(TARGET)
	cp $(TARGET) /usr/bin/
	cp scripts/tianwang-agent.init /etc/init.d/tianwang-agent
	chmod +x /etc/init.d/tianwang-agent
	cp config/tianwang-agent.config /etc/config/tianwang-agent

# 卸载
uninstall:
	rm -f /usr/bin/tianwang-agent
	rm -f /etc/init.d/tianwang-agent
	rm -f /etc/config/tianwang-agent

# 清理
clean:
	rm -rf $(BUILDDIR) $(BINDIR)

# 测试
test: $(TARGET)
	@echo "Running tests..."
	@cd $(TESTDIR) && ./run_tests.sh

# 交叉编译 (OpenWrt SDK)
cross-compile:
	@echo "Cross-compiling for OpenWrt..."
	@if [ -z "$(OPENWRT_SDK)" ]; then \
		echo "Error: OPENWRT_SDK environment variable not set"; \
		exit 1; \
	fi
	$(MAKE) CC=$(OPENWRT_SDK)/staging_dir/toolchain-*/bin/*-gcc \
			CFLAGS="$(CFLAGS) -I$(OPENWRT_SDK)/staging_dir/target-*/usr/include" \
			LDFLAGS="$(LDFLAGS) -L$(OPENWRT_SDK)/staging_dir/target-*/usr/lib"

# 创建OpenWrt包
package:
	@echo "Creating OpenWrt package..."
	mkdir -p package/tianwang-agent
	cp -r Makefile src scripts config package/tianwang-agent/
	cd package && tar czf tianwang-agent.tar.gz tianwang-agent/

# 调试版本
debug: CFLAGS += -g -DDEBUG
debug: $(TARGET)

# 发布版本
release: CFLAGS += -DNDEBUG
release: clean $(TARGET)

# 帮助
help:
	@echo "Available targets:"
	@echo "  all          - Build the agent (default)"
	@echo "  install      - Install to OpenWrt system"
	@echo "  uninstall    - Remove from OpenWrt system"
	@echo "  clean        - Remove build files"
	@echo "  test         - Run tests"
	@echo "  cross-compile- Cross-compile for OpenWrt"
	@echo "  package      - Create OpenWrt package"
	@echo "  debug        - Build debug version"
	@echo "  release      - Build release version"
	@echo "  help         - Show this help"

.PHONY: all install uninstall clean test cross-compile package debug release help 
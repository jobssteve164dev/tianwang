# OpenWrt Agent Tests Makefile

CC = gcc
CFLAGS = -Wall -Wextra -std=c11 -g -DTEST_MODE
LDFLAGS = -luci -ljson-c

# Directories
SRCDIR = ../src
TESTDIR = .
BUILDDIR = build

# Test sources and targets
TEST_SOURCES = $(wildcard test_*.c)
TEST_OBJECTS = $(TEST_SOURCES:%.c=$(BUILDDIR)/%.o)
TEST_TARGETS = $(TEST_SOURCES:%.c=$(BUILDDIR)/%)

# Source files to test (exclude main.c)
SRC_FILES = $(filter-out $(SRCDIR)/main.c, $(wildcard $(SRCDIR)/*.c))
SRC_OBJECTS = $(SRC_FILES:$(SRCDIR)/%.c=$(BUILDDIR)/%.o)

# Default target
all: $(TEST_TARGETS)

# Create build directory
$(BUILDDIR):
	mkdir -p $(BUILDDIR)

# Compile source files
$(BUILDDIR)/%.o: $(SRCDIR)/%.c | $(BUILDDIR)
	$(CC) $(CFLAGS) -I$(SRCDIR) -c $< -o $@

# Compile test files
$(BUILDDIR)/%.o: %.c | $(BUILDDIR)
	$(CC) $(CFLAGS) -I$(SRCDIR) -c $< -o $@

# Link test executables
$(BUILDDIR)/test_%: $(BUILDDIR)/test_%.o $(SRC_OBJECTS) | $(BUILDDIR)
	$(CC) $^ $(LDFLAGS) -o $@

# Run all tests
test: $(TEST_TARGETS)
	@echo "Running all tests..."
	@for test in $(TEST_TARGETS); do \
		echo ""; \
		echo "Running $$test..."; \
		$$test || exit 1; \
	done
	@echo ""
	@echo "All tests completed successfully!"

# Run specific test
test-%: $(BUILDDIR)/test_%
	@echo "Running test_$*..."
	@$(BUILDDIR)/test_$*

# Clean
clean:
	rm -rf $(BUILDDIR)

# Debug target (compile with debug symbols and no optimization)
debug: CFLAGS += -g -O0 -DDEBUG
debug: $(TEST_TARGETS)

# Coverage target (requires gcov)
coverage: CFLAGS += --coverage
coverage: LDFLAGS += --coverage
coverage: clean $(TEST_TARGETS)
	@echo "Running tests with coverage..."
	@for test in $(TEST_TARGETS); do \
		$$test || exit 1; \
	done
	@echo "Generating coverage report..."
	@gcov $(SRC_FILES)
	@echo "Coverage files generated: *.gcov"

# Memory check with valgrind (if available)
memcheck: $(TEST_TARGETS)
	@echo "Running memory checks..."
	@for test in $(TEST_TARGETS); do \
		echo "Memory checking $$test..."; \
		valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes $$test || true; \
	done

# Static analysis with cppcheck (if available)
static-analysis:
	@echo "Running static analysis..."
	@cppcheck --enable=all --std=c11 --language=c $(SRCDIR)/ $(TESTDIR)/ || true

# Help
help:
	@echo "Available targets:"
	@echo "  all          - Build all tests"
	@echo "  test         - Run all tests"
	@echo "  test-<name>  - Run specific test (e.g., test-config)"
	@echo "  clean        - Remove build files"
	@echo "  debug        - Build with debug symbols"
	@echo "  coverage     - Build and run with coverage analysis"
	@echo "  memcheck     - Run tests with valgrind memory check"
	@echo "  static-analysis - Run cppcheck static analysis"
	@echo "  help         - Show this help"

.PHONY: all test clean debug coverage memcheck static-analysis help 
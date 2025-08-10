#!/usr/bin/env node
/**
 * 带缓存优化的构建脚本
 * Build Script with Cache Optimization
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

class BuildWithCache {
  constructor() {
    this.buildCache = path.join(__dirname, '../.build-cache');
    this.dockerCache = path.join(__dirname, '../.docker-cache');
    this.startTime = Date.now();
  }

  /**
   * 初始化缓存目录
   */
  initCacheDirectories() {
    const dirs = [this.buildCache, this.dockerCache];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ 创建缓存目录: ${dir}`);
      }
    });
  }

  /**
   * 清理旧的缓存
   */
  cleanOldCache() {
    const cacheAge = 7 * 24 * 60 * 60 * 1000; // 7天
    const now = Date.now();

    [this.buildCache, this.dockerCache].forEach(cacheDir => {
      if (fs.existsSync(cacheDir)) {
        const files = fs.readdirSync(cacheDir);
        files.forEach(file => {
          const filePath = path.join(cacheDir, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtime.getTime() > cacheAge) {
            fs.unlinkSync(filePath);
            console.log(`🗑️  清理旧缓存: ${file}`);
          }
        });
      }
    });
  }

  /**
   * 检查Docker缓存状态
   */
  checkDockerCache() {
    try {
      const result = execSync('docker system df', { encoding: 'utf8' });
      console.log('📊 Docker缓存状态:');
      console.log(result);
    } catch (error) {
      console.log('⚠️  无法检查Docker缓存状态');
    }
  }

  /**
   * 构建Docker镜像（带缓存）
   */
  async buildDockerImage(service, options = {}) {
    const { useCache = true, noCache = false, pull = false } = options;
    
    console.log(`🐳 构建 ${service} 镜像...`);
    
    const args = ['build'];
    
    if (useCache && !noCache) {
      args.push('--build-arg', 'BUILDKIT_INLINE_CACHE=1');
    }
    
    if (noCache) {
      args.push('--no-cache');
    }
    
    if (pull) {
      args.push('--pull');
    }
    
    args.push(
      '--target', 'production',
      '-t', `tianwang-${service}:latest`,
      '-f', `docker/${service}/Dockerfile`,
      '.'
    );

    return new Promise((resolve, reject) => {
      const build = spawn('docker', args, {
        stdio: 'inherit',
        env: {
          ...process.env,
          DOCKER_BUILDKIT: '1',
          COMPOSE_DOCKER_CLI_BUILD: '1'
        }
      });

      build.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ ${service} 镜像构建成功`);
          resolve();
        } else {
          console.error(`❌ ${service} 镜像构建失败`);
          reject(new Error(`构建失败，退出码: ${code}`));
        }
      });
    });
  }

  /**
   * 并行构建多个服务
   */
  async buildServices(services, options = {}) {
    console.log(`🚀 开始构建服务: ${services.join(', ')}`);
    
    const buildPromises = services.map(service => 
      this.buildDockerImage(service, options)
    );
    
    try {
      await Promise.all(buildPromises);
      console.log('✅ 所有服务构建完成');
    } catch (error) {
      console.error('❌ 部分服务构建失败:', error.message);
      throw error;
    }
  }

  /**
   * 构建前端（带缓存）
   */
  async buildFrontend() {
    console.log('⚛️  构建前端应用...');
    
    const clientDir = path.join(__dirname, '../client');
    const cacheDir = path.join(this.buildCache, 'client');
    
    // 创建缓存目录
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      const build = spawn('npm', ['run', 'build'], {
        cwd: clientDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'production',
          // 使用缓存目录
          npm_config_cache: cacheDir
        }
      });

      build.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 前端构建成功');
          resolve();
        } else {
          console.error('❌ 前端构建失败');
          reject(new Error(`前端构建失败，退出码: ${code}`));
        }
      });
    });
  }

  /**
   * 构建后端（带缓存）
   */
  async buildBackend() {
    console.log('🔧 构建后端应用...');
    
    const serverDir = path.join(__dirname, '../server');
    const cacheDir = path.join(this.buildCache, 'server');
    
    // 创建缓存目录
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    return new Promise((resolve, reject) => {
      const build = spawn('npm', ['run', 'build'], {
        cwd: serverDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          NODE_ENV: 'production',
          // 使用缓存目录
          npm_config_cache: cacheDir
        }
      });

      build.on('close', (code) => {
        if (code === 0) {
          console.log('✅ 后端构建成功');
          resolve();
        } else {
          console.error('❌ 后端构建失败');
          reject(new Error(`后端构建失败，退出码: ${code}`));
        }
      });
    });
  }

  /**
   * 显示构建统计
   */
  showBuildStats() {
    const endTime = Date.now();
    const duration = (endTime - this.startTime) / 1000;
    
    console.log('\n📊 构建统计');
    console.log('='.repeat(30));
    console.log(`总耗时: ${duration.toFixed(2)}秒`);
    console.log(`缓存目录: ${this.buildCache}`);
    console.log(`Docker缓存: ${this.dockerCache}`);
    
    // 显示缓存大小
    try {
      const buildCacheSize = this.getDirectorySize(this.buildCache);
      const dockerCacheSize = this.getDirectorySize(this.dockerCache);
      
      console.log(`构建缓存大小: ${(buildCacheSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`Docker缓存大小: ${(dockerCacheSize / 1024 / 1024).toFixed(2)} MB`);
    } catch (error) {
      console.log('无法计算缓存大小');
    }
  }

  /**
   * 获取目录大小
   */
  getDirectorySize(dirPath) {
    if (!fs.existsSync(dirPath)) return 0;
    
    let size = 0;
    const files = fs.readdirSync(dirPath);
    
    files.forEach(file => {
      const filePath = path.join(dirPath, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isDirectory()) {
        size += this.getDirectorySize(filePath);
      } else {
        size += stats.size;
      }
    });
    
    return size;
  }

  /**
   * 清理构建缓存
   */
  cleanBuildCache() {
    console.log('🧹 清理构建缓存...');
    
    [this.buildCache, this.dockerCache].forEach(cacheDir => {
      if (fs.existsSync(cacheDir)) {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        console.log(`✅ 清理缓存: ${cacheDir}`);
      }
    });
  }

  /**
   * 运行完整构建流程
   */
  async run(options = {}) {
    const { 
      services = ['server', 'client'], 
      cleanCache = false, 
      noCache = false,
      parallel = true 
    } = options;

    console.log('🚀 开始带缓存的构建流程...\n');

    try {
      // 1. 初始化缓存
      this.initCacheDirectories();
      
      // 2. 清理旧缓存
      this.cleanOldCache();
      
      // 3. 检查Docker缓存
      this.checkDockerCache();
      
      // 4. 清理缓存（如果需要）
      if (cleanCache) {
        this.cleanBuildCache();
        this.initCacheDirectories();
      }
      
      // 5. 构建应用
      if (parallel) {
        // 并行构建
        await Promise.all([
          this.buildBackend(),
          this.buildFrontend()
        ]);
      } else {
        // 串行构建
        await this.buildBackend();
        await this.buildFrontend();
      }
      
      // 6. 构建Docker镜像
      await this.buildServices(services, { noCache });
      
      // 7. 显示统计
      this.showBuildStats();
      
      console.log('\n🎉 构建完成！');
      
    } catch (error) {
      console.error('\n❌ 构建失败:', error.message);
      process.exit(1);
    }
  }
}

// 命令行接口
if (require.main === module) {
  const builder = new BuildWithCache();
  
  const args = process.argv.slice(2);
  const options = {
    services: ['server', 'client'],
    cleanCache: args.includes('--clean-cache'),
    noCache: args.includes('--no-cache'),
    parallel: !args.includes('--serial')
  };
  
  // 解析服务参数
  const serviceIndex = args.indexOf('--services');
  if (serviceIndex !== -1 && args[serviceIndex + 1]) {
    options.services = args[serviceIndex + 1].split(',');
  }
  
  console.log('📋 构建选项:', options);
  
  builder.run(options);
}

module.exports = BuildWithCache;

/**
 * 备份管理脚本
 * Backup Manager - 数据备份和恢复
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');

class BackupManager {
  constructor() {
    this.backupDir = path.join(__dirname, '../../backups');
    this.config = {
      postgres: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'tianwang',
        username: process.env.DB_USER || 'tianwang',
        password: process.env.DB_PASSWORD || 'tianwang123'
      },
      retention: {
        daily: 7,    // 保留7天
        weekly: 4,   // 保留4周
        monthly: 12  // 保留12个月
      },
      compression: true,
      encryption: true
    };
  }

  /**
   * 初始化备份目录
   */
  initBackupDirectory() {
    const dirs = [
      this.backupDir,
      path.join(this.backupDir, 'daily'),
      path.join(this.backupDir, 'weekly'),
      path.join(this.backupDir, 'monthly'),
      path.join(this.backupDir, 'logs')
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ 创建备份目录: ${dir}`);
      }
    });
  }

  /**
   * 生成备份文件名
   */
  generateBackupFileName(type = 'daily') {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `tianwang-${type}-${timestamp}`;
  }

  /**
   * 加密备份文件
   */
  async encryptFile(inputPath, outputPath) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.BACKUP_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipher(algorithm, key);
    cipher.setAAD(Buffer.from('tianwang-backup', 'utf8'));

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    // 写入IV
    output.write(iv);

    input.pipe(cipher).pipe(output);

    return new Promise((resolve, reject) => {
      output.on('finish', () => {
        const tag = cipher.getAuthTag();
        // 在文件末尾写入认证标签
        fs.appendFileSync(outputPath, tag);
        resolve();
      });
      output.on('error', reject);
    });
  }

  /**
   * 解密备份文件
   */
  async decryptFile(inputPath, outputPath) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.BACKUP_ENCRYPTION_KEY || 'default-key', 'salt', 32);

    const input = fs.createReadStream(inputPath);
    const output = fs.createWriteStream(outputPath);

    // 读取IV
    const iv = Buffer.alloc(16);
    input.read(iv);

    const decipher = crypto.createDecipher(algorithm, key);
    decipher.setAAD(Buffer.from('tianwang-backup', 'utf8'));

    // 读取认证标签
    const stats = fs.statSync(inputPath);
    const tag = Buffer.alloc(16);
    const tagStart = stats.size - 16;
    
    const tagBuffer = fs.readFileSync(inputPath);
    const fileTag = tagBuffer.slice(tagStart);
    decipher.setAuthTag(fileTag);

    // 创建不包含标签的流
    const inputWithoutTag = fs.createReadStream(inputPath, { end: tagStart - 1 });
    inputWithoutTag.pipe(decipher).pipe(output);

    return new Promise((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  /**
   * 备份PostgreSQL数据库
   */
  async backupPostgreSQL(type = 'daily') {
    const fileName = this.generateBackupFileName(type);
    const backupPath = path.join(this.backupDir, type, `${fileName}.sql`);
    const compressedPath = `${backupPath}.gz`;
    const encryptedPath = `${compressedPath}.enc`;

    try {
      console.log(`🗄️  开始备份PostgreSQL数据库...`);

      // 执行pg_dump
      const pgDumpCmd = `PGPASSWORD="${this.config.postgres.password}" pg_dump -h ${this.config.postgres.host} -p ${this.config.postgres.port} -U ${this.config.postgres.username} -d ${this.config.postgres.database} --verbose --clean --if-exists --no-owner --no-privileges > ${backupPath}`;
      
      execSync(pgDumpCmd, { stdio: 'inherit' });

      // 压缩备份文件
      if (this.config.compression) {
        console.log('📦 压缩备份文件...');
        execSync(`gzip ${backupPath}`);
        fs.unlinkSync(backupPath); // 删除未压缩的文件
      }

      // 加密备份文件
      if (this.config.encryption) {
        console.log('🔐 加密备份文件...');
        const sourcePath = this.config.compression ? compressedPath : backupPath;
        await this.encryptFile(sourcePath, encryptedPath);
        fs.unlinkSync(sourcePath); // 删除未加密的文件
      }

      const finalPath = this.config.encryption ? encryptedPath : (this.config.compression ? compressedPath : backupPath);
      const fileSize = fs.statSync(finalPath).size;
      
      console.log(`✅ PostgreSQL备份完成: ${finalPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      
      return {
        type: 'postgresql',
        path: finalPath,
        size: fileSize,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ PostgreSQL备份失败:', error.message);
      throw error;
    }
  }

  /**
   * 备份Redis数据
   */
  async backupRedis(type = 'daily') {
    const fileName = this.generateBackupFileName(type);
    const backupPath = path.join(this.backupDir, type, `${fileName}-redis.rdb`);
    const compressedPath = `${backupPath}.gz`;
    const encryptedPath = `${compressedPath}.enc`;

    try {
      console.log(`🔴 开始备份Redis数据...`);

      // 触发Redis BGSAVE
      execSync('redis-cli -h localhost -p 6379 -a tianwang123 BGSAVE');
      
      // 等待BGSAVE完成
      let bgsaveStatus = 'in_progress';
      while (bgsaveStatus === 'in_progress') {
        const status = execSync('redis-cli -h localhost -p 6379 -a tianwang123 info persistence', { encoding: 'utf8' });
        const match = status.match(/rdb_bgsave_in_progress:(\d+)/);
        bgsaveStatus = match ? (match[1] === '0' ? 'completed' : 'in_progress') : 'unknown';
        
        if (bgsaveStatus === 'in_progress') {
          console.log('⏳ 等待Redis BGSAVE完成...');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // 复制RDB文件
      const rdbSource = '/var/lib/redis/dump.rdb';
      if (fs.existsSync(rdbSource)) {
        fs.copyFileSync(rdbSource, backupPath);
      } else {
        throw new Error('Redis RDB文件不存在');
      }

      // 压缩备份文件
      if (this.config.compression) {
        console.log('📦 压缩Redis备份文件...');
        execSync(`gzip ${backupPath}`);
        fs.unlinkSync(backupPath);
      }

      // 加密备份文件
      if (this.config.encryption) {
        console.log('🔐 加密Redis备份文件...');
        const sourcePath = this.config.compression ? compressedPath : backupPath;
        await this.encryptFile(sourcePath, encryptedPath);
        fs.unlinkSync(sourcePath);
      }

      const finalPath = this.config.encryption ? encryptedPath : (this.config.compression ? compressedPath : backupPath);
      const fileSize = fs.statSync(finalPath).size;
      
      console.log(`✅ Redis备份完成: ${finalPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      
      return {
        type: 'redis',
        path: finalPath,
        size: fileSize,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ Redis备份失败:', error.message);
      throw error;
    }
  }

  /**
   * 备份配置文件
   */
  async backupConfigs(type = 'daily') {
    const fileName = this.generateBackupFileName(type);
    const backupPath = path.join(this.backupDir, type, `${fileName}-configs.tar.gz`);
    const encryptedPath = `${backupPath}.enc`;

    try {
      console.log(`⚙️  开始备份配置文件...`);

      // 创建配置文件归档
      const configDirs = [
        'config',
        'server/src/config',
        'docker'
      ];

      const tarCmd = `tar -czf ${backupPath} ${configDirs.join(' ')}`;
      execSync(tarCmd, { stdio: 'inherit' });

      // 加密备份文件
      if (this.config.encryption) {
        console.log('🔐 加密配置文件备份...');
        await this.encryptFile(backupPath, encryptedPath);
        fs.unlinkSync(backupPath);
      }

      const finalPath = this.config.encryption ? encryptedPath : backupPath;
      const fileSize = fs.statSync(finalPath).size;
      
      console.log(`✅ 配置文件备份完成: ${finalPath} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
      
      return {
        type: 'configs',
        path: finalPath,
        size: fileSize,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('❌ 配置文件备份失败:', error.message);
      throw error;
    }
  }

  /**
   * 执行完整备份
   */
  async performFullBackup(type = 'daily') {
    console.log(`🚀 开始执行${type}备份...\n`);

    this.initBackupDirectory();

    const results = [];
    const startTime = Date.now();

    try {
      // 并行执行备份任务
      const backupTasks = [
        this.backupPostgreSQL(type),
        this.backupRedis(type),
        this.backupConfigs(type)
      ];

      const backupResults = await Promise.all(backupTasks);
      results.push(...backupResults);

      // 生成备份报告
      const endTime = Date.now();
      const duration = (endTime - startTime) / 1000;
      const totalSize = results.reduce((sum, result) => sum + result.size, 0);

      const report = {
        type,
        timestamp: new Date().toISOString(),
        duration: `${duration.toFixed(2)}s`,
        totalSize: `${(totalSize / 1024 / 1024).toFixed(2)} MB`,
        results
      };

      // 保存备份报告
      const reportPath = path.join(this.backupDir, 'logs', `${fileName}-backup-report.json`);
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

      console.log(`\n📊 备份报告:`);
      console.log(`   类型: ${type}`);
      console.log(`   耗时: ${duration.toFixed(2)}秒`);
      console.log(`   总大小: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   备份项目: ${results.length}个`);
      console.log(`   报告文件: ${reportPath}`);

      // 清理旧备份
      await this.cleanupOldBackups();

      console.log(`\n🎉 ${type}备份完成！`);

    } catch (error) {
      console.error(`\n❌ ${type}备份失败:`, error.message);
      throw error;
    }
  }

  /**
   * 清理旧备份
   */
  async cleanupOldBackups() {
    console.log('🧹 清理旧备份文件...');

    const types = ['daily', 'weekly', 'monthly'];
    
    for (const type of types) {
      const typeDir = path.join(this.backupDir, type);
      if (!fs.existsSync(typeDir)) continue;

      const files = fs.readdirSync(typeDir)
        .filter(file => file.endsWith('.sql.gz.enc') || file.endsWith('.rdb.gz.enc') || file.endsWith('.tar.gz.enc'))
        .map(file => ({
          name: file,
          path: path.join(typeDir, file),
          mtime: fs.statSync(path.join(typeDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      const retention = this.config.retention[type];
      const filesToDelete = files.slice(retention);

      filesToDelete.forEach(file => {
        fs.unlinkSync(file.path);
        console.log(`   删除: ${file.name}`);
      });
    }
  }

  /**
   * 恢复PostgreSQL数据库
   */
  async restorePostgreSQL(backupPath) {
    try {
      console.log(`🗄️  开始恢复PostgreSQL数据库...`);

      let restorePath = backupPath;

      // 解密备份文件
      if (backupPath.endsWith('.enc')) {
        console.log('🔓 解密备份文件...');
        const decryptedPath = backupPath.replace('.enc', '');
        await this.decryptFile(backupPath, decryptedPath);
        restorePath = decryptedPath;
      }

      // 解压备份文件
      if (restorePath.endsWith('.gz')) {
        console.log('📦 解压备份文件...');
        execSync(`gunzip ${restorePath}`);
        restorePath = restorePath.replace('.gz', '');
      }

      // 恢复数据库
      const restoreCmd = `PGPASSWORD="${this.config.postgres.password}" psql -h ${this.config.postgres.host} -p ${this.config.postgres.port} -U ${this.config.postgres.username} -d ${this.config.postgres.database} < ${restorePath}`;
      
      execSync(restoreCmd, { stdio: 'inherit' });

      // 清理临时文件
      if (restorePath !== backupPath) {
        fs.unlinkSync(restorePath);
      }

      console.log('✅ PostgreSQL数据库恢复完成！');

    } catch (error) {
      console.error('❌ PostgreSQL数据库恢复失败:', error.message);
      throw error;
    }
  }

  /**
   * 列出可用备份
   */
  listBackups() {
    console.log('📋 可用备份列表:\n');

    const types = ['daily', 'weekly', 'monthly'];
    
    types.forEach(type => {
      const typeDir = path.join(this.backupDir, type);
      if (!fs.existsSync(typeDir)) return;

      const files = fs.readdirSync(typeDir)
        .filter(file => file.endsWith('.sql.gz.enc') || file.endsWith('.rdb.gz.enc') || file.endsWith('.tar.gz.enc'))
        .map(file => {
          const filePath = path.join(typeDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: (stats.size / 1024 / 1024).toFixed(2),
            date: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));

      if (files.length > 0) {
        console.log(`${type.toUpperCase()} 备份:`);
        files.forEach(file => {
          console.log(`  ${file.name} (${file.size} MB) - ${file.date}`);
        });
        console.log('');
      }
    });
  }
}

// 命令行接口
if (require.main === module) {
  const manager = new BackupManager();
  const command = process.argv[2];
  const type = process.argv[3] || 'daily';

  switch (command) {
    case 'backup':
      manager.performFullBackup(type);
      break;
    case 'restore':
      const backupPath = process.argv[3];
      if (!backupPath) {
        console.error('❌ 请指定备份文件路径');
        process.exit(1);
      }
      manager.restorePostgreSQL(backupPath);
      break;
    case 'list':
      manager.listBackups();
      break;
    default:
      console.log('📖 使用方法:');
      console.log('  node backup-manager.js backup [daily|weekly|monthly]');
      console.log('  node backup-manager.js restore <backup-file>');
      console.log('  node backup-manager.js list');
  }
}

module.exports = BackupManager;

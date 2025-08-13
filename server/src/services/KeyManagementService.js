const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class KeyManagementService {
  constructor() {
    this.keysPath = path.join(__dirname, '../../keys');
    this.publicKeyPath = path.join(this.keysPath, 'public.pem');
    this.privateKeyPath = path.join(this.keysPath, 'private.pem');
    this.keyRotationInterval = 24 * 60 * 60 * 1000; // 24小时
    this.lastRotation = null;
    this.publicKey = null;
    this.privateKey = null;
  }

  // 初始化密钥管理服务
  async initialize() {
    try {
      // 确保密钥目录存在
      await this.ensureKeysDirectory();
      
      // 加载或生成密钥对
      await this.loadOrGenerateKeys();
      
      // 启动密钥轮换定时器
      this.startKeyRotation();
      
      logger.info('密钥管理服务初始化完成');
    } catch (error) {
      logger.error('密钥管理服务初始化失败:', error);
      throw error;
    }
  }

  // 确保密钥目录存在
  async ensureKeysDirectory() {
    try {
      await fs.access(this.keysPath);
    } catch (error) {
      await fs.mkdir(this.keysPath, { recursive: true });
      logger.info('创建密钥目录:', this.keysPath);
    }
  }

  // 加载或生成密钥对
  async loadOrGenerateKeys() {
    try {
      // 尝试加载现有密钥
      const publicKeyExists = await this.fileExists(this.publicKeyPath);
      const privateKeyExists = await this.fileExists(this.privateKeyPath);

      if (publicKeyExists && privateKeyExists) {
        await this.loadKeys();
        logger.info('加载现有密钥对');
      } else {
        await this.generateKeys();
        logger.info('生成新的密钥对');
      }
    } catch (error) {
      logger.error('加载或生成密钥失败:', error);
      throw error;
    }
  }

  // 检查文件是否存在
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  // 生成新的RSA密钥对
  async generateKeys() {
    try {
      // 生成RSA密钥对
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem'
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem'
        }
      });

      // 保存密钥到文件
      await fs.writeFile(this.publicKeyPath, publicKey);
      await fs.writeFile(this.privateKeyPath, privateKey);

      // 设置密钥
      this.publicKey = publicKey;
      this.privateKey = privateKey;
      this.lastRotation = new Date();

      logger.info('RSA密钥对生成完成');
    } catch (error) {
      logger.error('生成密钥对失败:', error);
      throw error;
    }
  }

  // 加载现有密钥
  async loadKeys() {
    try {
      this.publicKey = await fs.readFile(this.publicKeyPath, 'utf8');
      this.privateKey = await fs.readFile(this.privateKeyPath, 'utf8');
      
      // 获取文件修改时间作为最后轮换时间
      const stats = await fs.stat(this.privateKeyPath);
      this.lastRotation = stats.mtime;
    } catch (error) {
      logger.error('加载密钥失败:', error);
      throw error;
    }
  }

  // 启动密钥轮换定时器
  startKeyRotation() {
    setInterval(async () => {
      try {
        await this.rotateKeys();
      } catch (error) {
        logger.error('密钥轮换失败:', error);
      }
    }, this.keyRotationInterval);
  }

  // 轮换密钥
  async rotateKeys() {
    try {
      logger.info('开始密钥轮换...');
      
      // 备份旧密钥
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.keysPath, `backup-${timestamp}`);
      await fs.mkdir(backupPath, { recursive: true });
      
      await fs.copyFile(this.publicKeyPath, path.join(backupPath, 'public.pem'));
      await fs.copyFile(this.privateKeyPath, path.join(backupPath, 'private.pem'));
      
      // 生成新密钥
      await this.generateKeys();
      
      logger.info('密钥轮换完成');
    } catch (error) {
      logger.error('密钥轮换失败:', error);
      throw error;
    }
  }

  // 获取公钥
  getPublicKey() {
    return this.publicKey;
  }

  // 获取公钥信息
  getPublicKeyInfo() {
    if (!this.publicKey) {
      return null;
    }

    try {
      const key = crypto.createPublicKey(this.publicKey);
      const keyDetails = key.export({ format: 'jwk' });
      
      return {
        algorithm: 'RSA',
        keySize: 2048,
        format: 'PEM',
        lastRotation: this.lastRotation,
        fingerprint: this.generateFingerprint(this.publicKey)
      };
    } catch (error) {
      logger.error('获取公钥信息失败:', error);
      return null;
    }
  }

  // 生成密钥指纹
  generateFingerprint(key) {
    try {
      const hash = crypto.createHash('sha256');
      hash.update(key);
      return hash.digest('hex');
    } catch (error) {
      logger.error('生成密钥指纹失败:', error);
      return null;
    }
  }

  // 验证签名
  verifySignature(data, signature, encoding = 'base64') {
    try {
      const verifier = crypto.createVerify('SHA256');
      verifier.update(data);
      return verifier.verify(this.publicKey, signature, encoding);
    } catch (error) {
      logger.error('验证签名失败:', error);
      return false;
    }
  }

  // 创建签名
  createSignature(data) {
    try {
      const signer = crypto.createSign('SHA256');
      signer.update(data);
      return signer.sign(this.privateKey, 'base64');
    } catch (error) {
      logger.error('创建签名失败:', error);
      throw error;
    }
  }

  // 加密数据
  encrypt(data) {
    try {
      const buffer = Buffer.from(data, 'utf8');
      const encrypted = crypto.publicEncrypt(
        {
          key: this.publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        buffer
      );
      return encrypted.toString('base64');
    } catch (error) {
      logger.error('加密数据失败:', error);
      throw error;
    }
  }

  // 解密数据
  decrypt(encryptedData) {
    try {
      const buffer = Buffer.from(encryptedData, 'base64');
      const decrypted = crypto.privateDecrypt(
        {
          key: this.privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256'
        },
        buffer
      );
      return decrypted.toString('utf8');
    } catch (error) {
      logger.error('解密数据失败:', error);
      throw error;
    }
  }

  // 生成连接密钥
  generateConnectionKey() {
    try {
      const randomBytes = crypto.randomBytes(32);
      const timestamp = Date.now();
      const data = `${randomBytes.toString('hex')}:${timestamp}`;
      const signature = this.createSignature(data);
      
      return {
        key: randomBytes.toString('base64'),
        timestamp,
        signature,
        expiresAt: timestamp + (60 * 60 * 1000) // 1小时有效期
      };
    } catch (error) {
      logger.error('生成连接密钥失败:', error);
      throw error;
    }
  }

  // 验证连接密钥
  verifyConnectionKey(providedSignature, expectedKey) {
    try {
      // 如果提供的是完整的连接密钥对象
      if (typeof providedSignature === 'object' && providedSignature.key) {
        const { key, timestamp, signature, expiresAt } = providedSignature;
        
        // 检查过期时间
        if (Date.now() > expiresAt) {
          logger.warn('连接密钥已过期');
          return { isValid: false, error: '连接密钥已过期' };
        }
        
        // 验证签名
        const data = `${Buffer.from(key, 'base64').toString('hex')}:${timestamp}`;
        const isValid = this.verifySignature(data, signature);
        return { isValid, error: isValid ? null : '签名验证失败' };
      }
      
      // 如果提供的是签名字符串和期望的密钥字符串（WebSocket连接场景）
      if (typeof providedSignature === 'string' && typeof expectedKey === 'string') {
        // 在WebSocket连接中，providedSignature是连接密钥的签名
        // expectedKey是连接密钥本身，我们需要验证签名是否正确
        try {
          // 从连接密钥中提取信息并验证签名
          // 连接密钥格式应该是: key:timestamp:signature
          const parts = expectedKey.split(':');
          if (parts.length >= 3) {
            const key = parts[0];
            const timestamp = parseInt(parts[1]);
            const signature = parts[2];
            
            // 检查过期时间（1小时）
            if (Date.now() > timestamp + (60 * 60 * 1000)) {
              return { isValid: false, error: '连接密钥已过期' };
            }
            
            // 验证签名
            const data = `${key}:${timestamp}`;
            const isValid = this.verifySignature(data, signature);
            return { isValid, error: isValid ? null : '签名验证失败' };
          } else {
            // 如果格式不正确，尝试直接比较（向后兼容）
            const isValid = providedSignature === expectedKey;
            return { isValid, error: isValid ? null : '密钥格式不正确' };
          }
        } catch (error) {
          logger.error('验证连接密钥签名时出错:', error);
          return { isValid: false, error: '签名验证过程中发生错误' };
        }
      }
      
      return { isValid: false, error: '无效的密钥格式' };
    } catch (error) {
      logger.error('验证连接密钥失败:', error);
      return { isValid: false, error: error.message };
    }
  }

  // 清理过期的备份密钥
  async cleanupOldBackups(maxAge = 7 * 24 * 60 * 60 * 1000) { // 7天
    try {
      const files = await fs.readdir(this.keysPath);
      const backupDirs = files.filter(file => file.startsWith('backup-'));
      
      for (const dir of backupDirs) {
        const dirPath = path.join(this.keysPath, dir);
        const stats = await fs.stat(dirPath);
        
        if (Date.now() - stats.mtime.getTime() > maxAge) {
          await fs.rm(dirPath, { recursive: true, force: true });
          logger.info('清理过期备份:', dir);
        }
      }
    } catch (error) {
      logger.error('清理过期备份失败:', error);
    }
  }

  // 获取服务状态
  getStatus() {
    return {
      initialized: !!this.publicKey && !!this.privateKey,
      lastRotation: this.lastRotation,
      keyRotationInterval: this.keyRotationInterval,
      publicKeyInfo: this.getPublicKeyInfo()
    };
  }
}

module.exports = new KeyManagementService();

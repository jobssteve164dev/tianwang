const crypto = require('crypto');
const logger = require('../utils/logger');

class DeviceFingerprintService {
  constructor() {
    this.fingerprintCache = new Map();
    this.cacheExpiry = 30 * 60 * 1000; // 30分钟缓存
  }

  // 生成设备指纹
  generateFingerprint(deviceInfo) {
    try {
      console.log('开始生成设备指纹:', { 
        hostname: deviceInfo.hostname, 
        platform: deviceInfo.platform,
        arch: deviceInfo.arch 
      });

      const {
        hostname,
        platform,
        arch,
        macAddresses,
        cpuInfo,
        memoryInfo,
        diskInfo,
        networkInterfaces,
        systemUuid,
        biosInfo
      } = deviceInfo;

      // 构建指纹数据 - 与代理端保持一致
      const fingerprintData = {
        // 基础系统信息
        hostname: hostname || '',
        platform: platform || '',
        arch: arch || '',
        
        // 硬件信息
        macAddresses: this.normalizeMacAddresses(macAddresses),
        cpuInfo: this.normalizeCpuInfo(cpuInfo),
        memoryInfo: this.normalizeMemoryInfo(memoryInfo),
        diskInfo: this.normalizeDiskInfo(diskInfo),
        
        // 网络信息
        networkInterfaces: this.normalizeNetworkInterfaces(networkInterfaces),
        
        // 系统标识
        systemUuid: systemUuid || '',
        biosInfo: this.normalizeBiosInfo(biosInfo)
      };

      console.log('指纹数据构建完成:', {
        hostname: fingerprintData.hostname,
        platform: fingerprintData.platform,
        macCount: fingerprintData.macAddresses.length,
        diskCount: fingerprintData.diskInfo.length,
        networkCount: fingerprintData.networkInterfaces.length
      });

      // 生成指纹哈希 - 使用与代理端相同的算法
      const dataString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
      const hash = crypto.createHash('sha256');
      hash.update(dataString);
      const fingerprint = hash.digest('hex');
      
      // 缓存指纹
      this.cacheFingerprint(fingerprint, deviceInfo);

      console.log('设备指纹生成成功:', { 
        hostname, 
        platform, 
        dataLength: dataString.length
      });

      return {
        fingerprint,
        components: fingerprintData,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('生成设备指纹失败:', error);
      logger.error('生成设备指纹失败:', error);
      throw error;
    }
  }

  // 标准化MAC地址
  normalizeMacAddresses(macAddresses) {
    if (!macAddresses || !Array.isArray(macAddresses)) {
      return [];
    }

    return macAddresses
      .filter(mac => mac && typeof mac === 'string')
      .map(mac => mac.toLowerCase().replace(/[:-]/g, ''))
      .sort();
  }

  // 标准化CPU信息
  normalizeCpuInfo(cpuInfo) {
    if (!cpuInfo) {
      return {};
    }

    return {
      model: cpuInfo.model || '',
      cores: cpuInfo.cores || 0,
      architecture: cpuInfo.architecture || '',
      vendor: cpuInfo.vendor || ''
    };
  }

  // 标准化内存信息
  normalizeMemoryInfo(memoryInfo) {
    if (!memoryInfo) {
      return {};
    }

    return {
      total: memoryInfo.total || 0,
      type: memoryInfo.type || ''
    };
  }

  // 标准化磁盘信息
  normalizeDiskInfo(diskInfo) {
    if (!diskInfo || !Array.isArray(diskInfo)) {
      return [];
    }

    return diskInfo
      .filter(disk => disk && disk.serial)
      .map(disk => ({
        serial: disk.serial || '',
        model: disk.model || '',
        size: disk.size || 0
      }))
      .sort((a, b) => a.serial.localeCompare(b.serial));
  }

  // 标准化网络接口信息
  normalizeNetworkInterfaces(networkInterfaces) {
    if (!networkInterfaces || !Array.isArray(networkInterfaces)) {
      return [];
    }

    return networkInterfaces
      .filter(iface => iface && iface.name)
      .map(iface => ({
        name: iface.name || '',
        mac: iface.mac ? iface.mac.toLowerCase().replace(/[:-]/g, '') : '',
        type: iface.type || ''
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // 标准化BIOS信息
  normalizeBiosInfo(biosInfo) {
    if (!biosInfo) {
      return {};
    }

    return {
      vendor: biosInfo.vendor || '',
      version: biosInfo.version || '',
      releaseDate: biosInfo.releaseDate || ''
    };
  }

  // 哈希指纹数据
  hashFingerprintData(fingerprintData) {
    try {
      const dataString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
      const hash = crypto.createHash('sha256');
      hash.update(dataString);
      return hash.digest('hex');
    } catch (error) {
      logger.error('哈希指纹数据失败:', error);
      throw error;
    }
  }

  // 缓存指纹
  cacheFingerprint(fingerprint, deviceInfo) {
    this.fingerprintCache.set(fingerprint, {
      deviceInfo,
      timestamp: Date.now()
    });

    // 清理过期缓存
    this.cleanupExpiredCache();
  }

  // 清理过期缓存
  cleanupExpiredCache() {
    const now = Date.now();
    for (const [fingerprint, data] of this.fingerprintCache.entries()) {
      if (now - data.timestamp > this.cacheExpiry) {
        this.fingerprintCache.delete(fingerprint);
      }
    }
  }

  // 验证设备指纹
  verifyFingerprint(fingerprint, deviceInfo) {
    try {
      console.log('开始验证设备指纹:', {
        hostname: deviceInfo.hostname,
        platform: deviceInfo.platform
      });

      // 生成当前设备指纹
      const currentFingerprint = this.generateFingerprint(deviceInfo);
      
      // 比较指纹
      const isValid = currentFingerprint.fingerprint === fingerprint;
      
      console.log('设备指纹验证结果:', { 
        isValid, 
        match: isValid ? '完全匹配' : '不匹配'
      });

      return {
        isValid,
        currentFingerprint: currentFingerprint.fingerprint,
        expectedFingerprint: fingerprint,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('验证设备指纹失败:', error);
      logger.error('验证设备指纹失败:', error);
      return {
        isValid: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // 计算指纹相似度
  calculateSimilarity(fingerprint1, fingerprint2) {
    try {
      if (fingerprint1 === fingerprint2) {
        return 1.0;
      }

      // 使用编辑距离计算相似度
      const distance = this.levenshteinDistance(fingerprint1, fingerprint2);
      const maxLength = Math.max(fingerprint1.length, fingerprint2.length);
      
      return 1 - (distance / maxLength);
    } catch (error) {
      logger.error('计算指纹相似度失败:', error);
      return 0;
    }
  }

  // 计算编辑距离
  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  // 检测设备指纹变化
  detectFingerprintChanges(oldFingerprint, newFingerprint) {
    try {
      if (oldFingerprint === newFingerprint) {
        return {
          hasChanges: false,
          changes: []
        };
      }

      const changes = [];
      const similarity = this.calculateSimilarity(oldFingerprint, newFingerprint);

      if (similarity < 0.9) {
        changes.push({
          type: 'major_change',
          description: '设备指纹发生重大变化',
          similarity
        });
      } else if (similarity < 0.95) {
        changes.push({
          type: 'minor_change',
          description: '设备指纹发生轻微变化',
          similarity
        });
      }

      return {
        hasChanges: changes.length > 0,
        changes,
        similarity
      };
    } catch (error) {
      logger.error('检测指纹变化失败:', error);
      return {
        hasChanges: true,
        changes: [{
          type: 'error',
          description: '指纹检测过程中发生错误',
          error: error.message
        }],
        similarity: 0
      };
    }
  }

  // 生成设备指纹报告
  generateFingerprintReport(deviceInfo) {
    try {
      const fingerprint = this.generateFingerprint(deviceInfo);
      
      return {
        fingerprint: fingerprint.fingerprint,
        components: {
          system: {
            hostname: deviceInfo.hostname,
            platform: deviceInfo.platform,
            arch: deviceInfo.arch
          },
          hardware: {
            cpu: this.normalizeCpuInfo(deviceInfo.cpuInfo),
            memory: this.normalizeMemoryInfo(deviceInfo.memoryInfo),
            disks: this.normalizeDiskInfo(deviceInfo.diskInfo)
          },
          network: {
            interfaces: this.normalizeNetworkInterfaces(deviceInfo.networkInterfaces),
            macAddresses: this.normalizeMacAddresses(deviceInfo.macAddresses)
          },
          system_info: {
            uuid: deviceInfo.systemUuid,
            bios: this.normalizeBiosInfo(deviceInfo.biosInfo)
          }
        },
        timestamp: fingerprint.timestamp,
        version: '1.0'
      };
    } catch (error) {
      logger.error('生成指纹报告失败:', error);
      throw error;
    }
  }

  // 获取缓存统计
  getCacheStats() {
    return {
      size: this.fingerprintCache.size,
      expiry: this.cacheExpiry,
      timestamp: Date.now()
    };
  }

  // 清理所有缓存
  clearCache() {
    this.fingerprintCache.clear();
    logger.info('设备指纹缓存已清理');
  }

  // 获取服务状态
  getStatus() {
    return {
      initialized: true,
      cacheStats: this.getCacheStats(),
      timestamp: Date.now()
    };
  }
}

module.exports = new DeviceFingerprintService();

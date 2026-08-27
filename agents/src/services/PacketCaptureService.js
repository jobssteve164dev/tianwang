const crypto = require('crypto');
const fs = require('fs').promises;
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

class PacketCaptureService {
    constructor(options = {}) {
        this.spawn = options.spawn || spawn;
        this.fs = options.fs || fs;
        this.platform = options.platform || os.platform();
        this.tempRoot = options.tempRoot || path.join(os.tmpdir(), 'tianwang-evidence');
        this.maxCaptureSeconds = options.maxCaptureSeconds || 120;
        this.maxCaptureBytes = options.maxCaptureBytes || 50 * 1024 * 1024;
        this.activeCaptures = new Set();
    }

    validateRequest(params) {
        const duration = Number(params.duration_seconds);
        const maxBytes = Number(params.max_bytes);
        if (!Number.isInteger(duration) || duration < 1 || duration > this.maxCaptureSeconds) {
            throw Object.assign(new Error(`抓包时长必须在 1-${this.maxCaptureSeconds} 秒内`), { code: 'CAPTURE_DURATION_EXCEEDED' });
        }
        if (!Number.isInteger(maxBytes) || maxBytes < 1024 || maxBytes > this.maxCaptureBytes) {
            throw Object.assign(new Error(`抓包大小必须在 1024-${this.maxCaptureBytes} 字节内`), { code: 'CAPTURE_SIZE_EXCEEDED' });
        }
        if (params.interface && params.interface !== 'auto' && !/^[a-zA-Z0-9_.:-]{1,64}$/.test(params.interface)) {
            throw Object.assign(new Error('网络接口名称不合法'), { code: 'INVALID_INTERFACE' });
        }

        const filter = params.filter || {};
        for (const ip of filter.peer_ips || []) {
            if (!net.isIP(ip)) throw Object.assign(new Error(`无效的对端 IP: ${ip}`), { code: 'INVALID_FILTER' });
        }
        for (const port of filter.ports || []) {
            if (!Number.isInteger(port) || port < 1 || port > 65535) {
                throw Object.assign(new Error(`无效的端口: ${port}`), { code: 'INVALID_FILTER' });
            }
        }
        for (const protocol of filter.protocols || []) {
            if (!['tcp', 'udp', 'icmp', 'icmp6'].includes(protocol)) {
                throw Object.assign(new Error(`不支持的协议: ${protocol}`), { code: 'INVALID_FILTER' });
            }
        }
    }

    buildFilter(filter = {}) {
        const groups = [];
        if (filter.peer_ips?.length) groups.push(`(${filter.peer_ips.map(ip => `host ${ip}`).join(' or ')})`);
        if (filter.ports?.length) groups.push(`(${filter.ports.map(port => `port ${port}`).join(' or ')})`);
        if (filter.protocols?.length) groups.push(`(${filter.protocols.join(' or ')})`);
        return groups.join(' and ');
    }

    async capture(taskId, params, onProgress = () => {}) {
        this.validateRequest(params);
        if (this.activeCaptures.size >= 1) {
            throw Object.assign(new Error('节点已有抓包任务正在执行'), { code: 'CAPTURE_CONCURRENCY_EXCEEDED' });
        }

        this.activeCaptures.add(taskId);
        await this.fs.mkdir(this.tempRoot, { recursive: true });
        const filePath = path.join(this.tempRoot, `${taskId}.pcap`);
        const startedAt = new Date();
        let truncated = false;

        try {
            const args = ['-U', '-n', '-w', filePath];
            const interfaceName = params.interface === 'auto' || !params.interface
                ? (this.platform === 'linux' ? 'any' : null)
                : params.interface;
            if (interfaceName) args.unshift('-i', interfaceName);
            const filter = this.buildFilter(params.filter);
            if (filter) args.push(filter);

            const stats = await this.runTcpdump(args, params.duration_seconds, params.max_bytes, filePath, value => {
                truncated = truncated || value.truncated;
                onProgress(value);
            });
            let content = await this.fs.readFile(filePath);
            if (content.length > params.max_bytes) {
                content = this.truncatePcap(content, params.max_bytes);
                truncated = true;
            }
            const sha256 = crypto.createHash('sha256').update(content).digest('hex');
            return {
                artifact_id: crypto.randomUUID(),
                type: 'application/vnd.tcpdump.pcap',
                size_bytes: content.length,
                sha256,
                content_base64: content.toString('base64'),
                started_at: startedAt.toISOString(),
                finished_at: new Date().toISOString(),
                collector: { name: 'tcpdump', version: 1, platform: this.platform },
                filter: params.filter || {},
                truncated,
                metrics: stats
            };
        } finally {
            this.activeCaptures.delete(taskId);
            await this.fs.unlink(filePath).catch(() => {});
        }
    }

    runTcpdump(args, durationSeconds, maxBytes, filePath, onProgress) {
        return new Promise((resolve, reject) => {
            const child = this.spawn('tcpdump', args, { stdio: ['ignore', 'ignore', 'pipe'] });
            let stderr = '';
            let settled = false;
            let truncated = false;
            const finish = (error, code) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                clearInterval(sizeTimer);
                if (error) return reject(Object.assign(error, { code: error.code || 'CAPTURE_FAILED' }));
                if (code !== 0 && code !== null) {
                    return reject(Object.assign(new Error(stderr.trim() || `tcpdump 退出码 ${code}`), { code: 'CAPTURE_FAILED' }));
                }
                const captured = Number(stderr.match(/(\d+) packets captured/)?.[1] || 0);
                const dropped = Number(stderr.match(/(\d+) packets dropped by kernel/)?.[1] || 0);
                resolve({ captured_packets: captured, dropped_packets: dropped, truncated });
            };

            child.stderr?.on('data', chunk => { stderr += chunk.toString(); });
            child.once('error', error => finish(Object.assign(new Error(`tcpdump 不可用: ${error.message}`), { code: 'CAPTURE_TOOL_UNAVAILABLE' })));
            child.once('close', code => finish(null, code));

            const timer = setTimeout(() => child.kill('SIGTERM'), durationSeconds * 1000);
            const sizeTimer = setInterval(async () => {
                const size = await this.fs.stat(filePath).then(value => value.size).catch(() => 0);
                onProgress({ phase: 'collecting', size_bytes: size, truncated: false });
                if (size >= maxBytes) {
                    truncated = true;
                    onProgress({ phase: 'collecting', size_bytes: size, truncated: true });
                    child.kill('SIGTERM');
                }
            }, 250);
        });
    }

    truncatePcap(content, maxBytes) {
        if (content.length < 24 || maxBytes < 24) {
            throw Object.assign(new Error('无法在字节上限内保留有效 PCAP'), { code: 'CAPTURE_SIZE_EXCEEDED' });
        }
        const magic = content.subarray(0, 4).toString('hex');
        const littleEndian = magic === 'd4c3b2a1' || magic === '4d3cb2a1';
        const bigEndian = magic === 'a1b2c3d4' || magic === 'a1b23c4d';
        if (!littleEndian && !bigEndian) {
            throw Object.assign(new Error('抓包格式无法安全截断'), { code: 'UNSUPPORTED_PCAP_FORMAT' });
        }
        let offset = 24;
        let safeEnd = 24;
        while (offset + 16 <= content.length) {
            const includedLength = littleEndian
                ? content.readUInt32LE(offset + 8)
                : content.readUInt32BE(offset + 8);
            const recordEnd = offset + 16 + includedLength;
            if (recordEnd > content.length || recordEnd > maxBytes) break;
            safeEnd = recordEnd;
            offset = recordEnd;
        }
        return content.subarray(0, safeEnd);
    }
}

module.exports = PacketCaptureService;

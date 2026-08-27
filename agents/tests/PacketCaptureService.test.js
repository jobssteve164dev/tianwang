const PacketCaptureService = require('../src/services/PacketCaptureService');

describe('PacketCaptureService request boundary', () => {
    const service = new PacketCaptureService({ maxCaptureSeconds: 120, maxCaptureBytes: 50 * 1024 * 1024 });

    test('builds a filter only from validated structured fields', () => {
        const params = {
            interface: 'eth0',
            duration_seconds: 60,
            max_bytes: 1024 * 1024,
            filter: { peer_ips: ['203.0.113.10'], protocols: ['tcp'], ports: [443] }
        };
        expect(() => service.validateRequest(params)).not.toThrow();
        expect(service.buildFilter(params.filter)).toBe('(host 203.0.113.10) and (port 443) and (tcp)');
    });

    test('rejects oversized, invalid and raw-filter-shaped requests', () => {
        expect(() => service.validateRequest({ duration_seconds: 121, max_bytes: 2048 })).toThrow('抓包时长');
        expect(() => service.validateRequest({ duration_seconds: 1, max_bytes: 2048, filter: { peer_ips: ['not-an-ip'] } })).toThrow('无效的对端');
        expect(() => service.validateRequest({ duration_seconds: 1, max_bytes: 2048, interface: 'eth0;id' })).toThrow('接口名称');
    });

    test('truncates classic PCAP only at a complete packet boundary', () => {
        const globalHeader = Buffer.alloc(24);
        globalHeader.writeUInt32LE(0xa1b2c3d4, 0);
        const packet = Buffer.alloc(16 + 10);
        packet.writeUInt32LE(10, 8);
        packet.writeUInt32LE(10, 12);
        const content = Buffer.concat([globalHeader, packet, packet]);
        const truncated = service.truncatePcap(content, 24 + 26);
        expect(truncated.length).toBe(50);
        expect(() => service.truncatePcap(Buffer.from('not-pcap'), 64)).toThrow('有效 PCAP');
    });
});

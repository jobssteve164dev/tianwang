jest.mock('electron-store', () => class MockStore {
    get(key, fallback) {
        return fallback;
    }

    set() {}
});

jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn()
}));

const EventService = require('../../src/services/EventService');

describe('EventService', () => {
    let service;

    beforeEach(() => {
        service = new EventService();
    });

    test('returns the exact persisted event for the detail pipeline', () => {
        const event = service.recordEvent({ title: '可疑连接', description: '连接到已知风险地址' });

        expect(service.getEvent(event.id)).toEqual(event);
        expect(service.getEvent('missing')).toBeNull();
    });

    test('CSV export escapes quotes and prevents spreadsheet formula execution', () => {
        service.recordEvent({
            title: '=HYPERLINK("https://example.invalid")',
            description: 'contains "quotes"',
            tags: ['audit']
        });

        const csv = service.exportEvents('csv');

        expect(csv).toContain('"\'=HYPERLINK(""https://example.invalid"")"');
        expect(csv).toContain('"contains ""quotes"""');
    });
});

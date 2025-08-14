const EventEmitter = require('events');
const logger = require('../utils/logger');
const Store = require('electron-store');

class EventService extends EventEmitter {
    constructor() {
        super();
        this.store = new Store();
        this.events = [];
        this.maxEvents = 1000; // 最大保存事件数量
        this.filters = {
            type: 'all',
            level: 'all',
            dateRange: 'all'
        };
        
        // 从持久化存储加载历史事件
        this.loadEvents();
    }

    // 记录事件
    recordEvent(event) {
        const eventRecord = {
            id: this.generateEventId(),
            timestamp: Date.now(),
            type: event.type || 'unknown',
            level: event.level || 'info',
            title: event.title || '未知事件',
            description: event.description || '',
            data: event.data || {},
            status: event.status || 'pending', // pending, sent, failed, acknowledged
            feedback: event.feedback || null,
            tags: event.tags || [],
            source: event.source || 'agent',
            ...event
        };

        // 添加到事件列表
        this.events.unshift(eventRecord); // 新事件添加到开头

        // 限制事件数量
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(0, this.maxEvents);
        }

        // 保存到持久化存储
        this.saveEvents();

        // 触发事件记录事件
        this.emit('event-recorded', eventRecord);

        logger.info(`事件已记录: ${eventRecord.title} (${eventRecord.type})`);
        return eventRecord;
    }

    // 更新事件状态
    updateEventStatus(eventId, status, feedback = null) {
        const event = this.events.find(e => e.id === eventId);
        if (event) {
            event.status = status;
            if (feedback) {
                event.feedback = feedback;
            }
            event.updatedAt = Date.now();
            
            // 保存到持久化存储
            this.saveEvents();
            
            // 触发事件更新事件
            this.emit('event-updated', event);
            
            logger.info(`事件状态已更新: ${event.title} -> ${status}`);
            return event;
        }
        return null;
    }

    // 标记事件反馈
    markEventFeedback(eventId, feedback) {
        return this.updateEventStatus(eventId, 'acknowledged', feedback);
    }

    // 获取事件列表
    getEvents(filters = {}) {
        let filteredEvents = [...this.events];

        // 应用类型过滤
        if (filters.type && filters.type !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.type === filters.type);
        }

        // 应用级别过滤
        if (filters.level && filters.level !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.level === filters.level);
        }

        // 应用状态过滤
        if (filters.status && filters.status !== 'all') {
            filteredEvents = filteredEvents.filter(e => e.status === filters.status);
        }

        // 应用日期范围过滤
        if (filters.dateRange && filters.dateRange !== 'all') {
            const now = Date.now();
            const oneDay = 24 * 60 * 60 * 1000;
            const oneWeek = 7 * oneDay;
            const oneMonth = 30 * oneDay;

            switch (filters.dateRange) {
                case 'today':
                    filteredEvents = filteredEvents.filter(e => (now - e.timestamp) < oneDay);
                    break;
                case 'week':
                    filteredEvents = filteredEvents.filter(e => (now - e.timestamp) < oneWeek);
                    break;
                case 'month':
                    filteredEvents = filteredEvents.filter(e => (now - e.timestamp) < oneMonth);
                    break;
            }
        }

        // 应用搜索过滤
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filteredEvents = filteredEvents.filter(e => 
                e.title.toLowerCase().includes(searchTerm) ||
                e.description.toLowerCase().includes(searchTerm) ||
                e.tags.some(tag => tag.toLowerCase().includes(searchTerm))
            );
        }

        // 排序
        if (filters.sortBy) {
            filteredEvents.sort((a, b) => {
                switch (filters.sortBy) {
                    case 'timestamp-desc':
                        return b.timestamp - a.timestamp;
                    case 'timestamp-asc':
                        return a.timestamp - b.timestamp;
                    case 'level':
                        const levelOrder = { 'error': 0, 'warning': 1, 'info': 2, 'success': 3 };
                        return levelOrder[a.level] - levelOrder[b.level];
                    case 'status':
                        const statusOrder = { 'failed': 0, 'pending': 1, 'sent': 2, 'acknowledged': 3 };
                        return statusOrder[a.status] - statusOrder[b.status];
                    default:
                        return b.timestamp - a.timestamp;
                }
            });
        }

        // 分页
        if (filters.page && filters.pageSize) {
            const start = (filters.page - 1) * filters.pageSize;
            const end = start + filters.pageSize;
            filteredEvents = filteredEvents.slice(start, end);
        }

        return filteredEvents;
    }

    // 获取事件统计
    getEventStats() {
        const stats = {
            total: this.events.length,
            byType: {},
            byLevel: {},
            byStatus: {},
            byDate: {
                today: 0,
                week: 0,
                month: 0
            }
        };

        const now = Date.now();
        const oneDay = 24 * 60 * 60 * 1000;
        const oneWeek = 7 * oneDay;
        const oneMonth = 30 * oneDay;

        this.events.forEach(event => {
            // 按类型统计
            stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;

            // 按级别统计
            stats.byLevel[event.level] = (stats.byLevel[event.level] || 0) + 1;

            // 按状态统计
            stats.byStatus[event.status] = (stats.byStatus[event.status] || 0) + 1;

            // 按日期统计
            const timeDiff = now - event.timestamp;
            if (timeDiff < oneDay) stats.byDate.today++;
            if (timeDiff < oneWeek) stats.byDate.week++;
            if (timeDiff < oneMonth) stats.byDate.month++;
        });

        return stats;
    }

    // 清除旧事件
    clearOldEvents(days = 30) {
        const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
        const originalCount = this.events.length;
        
        this.events = this.events.filter(event => event.timestamp > cutoffTime);
        
        const removedCount = originalCount - this.events.length;
        if (removedCount > 0) {
            this.saveEvents();
            logger.info(`已清除 ${removedCount} 条旧事件`);
        }
        
        return removedCount;
    }

    // 导出事件
    exportEvents(format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(this.events, null, 2);
            case 'csv':
                return this.exportToCSV();
            default:
                throw new Error(`不支持的导出格式: ${format}`);
        }
    }

    // 导出为CSV格式
    exportToCSV() {
        const headers = ['ID', '时间戳', '类型', '级别', '标题', '描述', '状态', '反馈', '标签', '来源'];
        const rows = this.events.map(event => [
            event.id,
            new Date(event.timestamp).toISOString(),
            event.type,
            event.level,
            event.title,
            event.description,
            event.status,
            event.feedback || '',
            event.tags.join(';'),
            event.source
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }

    // 生成事件ID
    generateEventId() {
        return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // 从持久化存储加载事件
    loadEvents() {
        try {
            const savedEvents = this.store.get('events', []);
            this.events = savedEvents;
            logger.info(`已加载 ${this.events.length} 条历史事件`);
        } catch (error) {
            logger.error('加载事件失败:', error);
            this.events = [];
        }
    }

    // 保存事件到持久化存储
    saveEvents() {
        try {
            this.store.set('events', this.events);
        } catch (error) {
            logger.error('保存事件失败:', error);
        }
    }

    // 获取事件类型列表
    getEventTypes() {
        const types = new Set();
        this.events.forEach(event => types.add(event.type));
        return Array.from(types).sort();
    }

    // 获取事件级别列表
    getEventLevels() {
        return ['error', 'warning', 'info', 'success'];
    }

    // 获取事件状态列表
    getEventStatuses() {
        return ['pending', 'sent', 'failed', 'acknowledged'];
    }
}

module.exports = EventService;

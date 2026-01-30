
import { AuditLogEntry } from '../types.ts';

export const auditLogService = {
  createLogEntry(
    module: AuditLogEntry['module'],
    action: AuditLogEntry['action'],
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    entityName: string,
    performedBy: string,
    previousValue?: string,
    newValue?: string,
    details?: string
  ): AuditLogEntry {
    return {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      module,
      action,
      entityType,
      entityId,
      entityName,
      previousValue,
      newValue,
      performedBy,
      details
    };
  },

  formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}-${month}-${year} ${hours}:${minutes}`;
  },

  filterLogs(
    logs: AuditLogEntry[],
    filters: {
      module?: AuditLogEntry['module'];
      action?: AuditLogEntry['action'];
      entityType?: AuditLogEntry['entityType'];
      entityId?: string;
      performedBy?: string;
      dateFrom?: Date;
      dateTo?: Date;
    }
  ): AuditLogEntry[] {
    return logs.filter(log => {
      if (filters.module && log.module !== filters.module) return false;
      if (filters.action && log.action !== filters.action) return false;
      if (filters.entityType && log.entityType !== filters.entityType) return false;
      if (filters.entityId && log.entityId !== filters.entityId) return false;
      if (filters.performedBy && log.performedBy !== filters.performedBy) return false;

      const logDate = new Date(log.timestamp);
      if (filters.dateFrom && logDate < filters.dateFrom) return false;
      if (filters.dateTo && logDate > filters.dateTo) return false;

      return true;
    });
  },

  getRecentLogs(logs: AuditLogEntry[], limit: number = 50): AuditLogEntry[] {
    return [...logs]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  },

  exportLogsToCSV(logs: AuditLogEntry[]): string {
    const headers = ['Timestamp', 'Module', 'Action', 'Entity Type', 'Entity ID', 'Entity Name', 'Previous Value', 'New Value', 'Performed By', 'Details'];
    const rows = logs.map(log => [
      this.formatTimestamp(log.timestamp),
      log.module,
      log.action,
      log.entityType,
      log.entityId,
      log.entityName,
      log.previousValue || '-',
      log.newValue || '-',
      log.performedBy,
      log.details || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }
};

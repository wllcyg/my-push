import React from 'react';
import { Table, TableProps } from 'antd';

export interface DataTableProps<T> extends Omit<TableProps<T>, 'pagination'> {
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number, pageSize: number) => void;
}

export function DataTable<T extends object>({
  page = 1,
  pageSize = 10,
  total = 0,
  onPageChange,
  rowKey = 'id',
  bordered = false,
  dataSource,
  ...restProps
}: DataTableProps<T>) {
  return (
    <Table<T>
      rowKey={rowKey}
      bordered={bordered}
      dataSource={dataSource ?? []}
      pagination={{
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        showQuickJumper: true,
        showTotal: (totalCount) => `共 ${totalCount} 条记录`,
        onChange: onPageChange,
      }}
      {...restProps}
    />
  );
}

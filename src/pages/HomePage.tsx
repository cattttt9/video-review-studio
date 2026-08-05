import { useCallback, useEffect, useState } from 'react';
import { Button, Empty, Form, Input, Modal, Popconfirm, Space, message } from 'antd';
import {
  DeleteOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  VideoCameraOutlined,
} from '@ant-design/icons';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/project';
import { useProjectStore } from '../stores/projectStore';
import { describeError } from '../services/invoke';
import type { RecentProjectEntry } from '../types';

export default function HomePage() {
  const navigate = useNavigate();
  const setProject = useProjectStore((s) => s.setProject);
  const [recent, setRecent] = useState<RecentProjectEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [droppedVideo, setDroppedVideo] = useState<string | null>(null);
  const [form] = Form.useForm();

  const loadRecent = useCallback(async () => {
    try {
      const list = await projectService.listRecentProjects();
      setRecent(list);
    } catch (err) {
      message.error(`读取最近项目失败：${describeError(err)}`);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadRecent().finally(() => setLoading(false));
  }, [loadRecent]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const webview = getCurrentWebview();
        unlisten = await webview.onDragDropEvent((event) => {
          if (event.payload.type === 'over') {
            setDragging(true);
          } else if (event.payload.type === 'leave') {
            setDragging(false);
          } else if (event.payload.type === 'drop') {
            setDragging(false);
            const path = event.payload.paths?.[0];
            if (path) {
              setDroppedVideo(path);
              setCreateOpen(true);
            }
          }
        });
      } catch {
        // 非 Tauri 环境（测试）忽略
      }
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  const openProject = async (dir: string) => {
    try {
      const project = await projectService.openProject(dir);
      setProject(project);
      navigate('/workspace');
    } catch (err) {
      message.error(`打开项目失败：${describeError(err)}`);
    }
  };

  const pickVideo = async () => {
    const path = await openDialog({
      multiple: false,
      filters: [
        {
          name: '视频文件',
          extensions: ['mp4', 'mov', 'mkv', 'webm', 'avi', 'flv', 'wmv', 'm4v', 'ts', 'mts'],
        },
      ],
    });
    if (typeof path === 'string') {
      form.setFieldValue('videoPath', path);
      setDroppedVideo(path);
    }
  };

  const pickParentDir = async () => {
    const dir = await openDialog({
      multiple: false,
      directory: true,
    });
    if (typeof dir === 'string') form.setFieldValue('parentDir', dir);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const project = await projectService.createProject(
        values.name,
        values.videoPath || null,
        values.parentDir || null,
      );
      setProject(project);
      setCreateOpen(false);
      message.success('项目创建成功');
      navigate('/workspace');
    } catch (err) {
      message.error(`创建项目失败：${describeError(err)}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="vrs-home">
      <div className="vrs-home-header">
        <h1 className="vrs-home-title">视频复盘工作台</h1>
        <p className="vrs-home-sub">本地视频拉片与游戏复盘工具 · 数据全部保存在本地，不上传</p>
        <Space>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={() => {
              setDroppedVideo(null);
              form.resetFields();
              setCreateOpen(true);
            }}
          >
            新建项目
          </Button>
          <Button
            size="large"
            icon={<FolderOpenOutlined />}
            onClick={async () => {
              const dir = await openDialog({ directory: true, multiple: false });
              if (typeof dir === 'string') await openProject(dir);
            }}
          >
            打开项目
          </Button>
        </Space>
      </div>
      <div className="vrs-home-body">
        <div
          className={`vrs-drop-zone ${dragging ? 'dragging' : ''}`}
          onClick={() => {
            setDroppedVideo(null);
            form.resetFields();
            setCreateOpen(true);
          }}
        >
          <VideoCameraOutlined style={{ fontSize: 28, marginBottom: 8 }} />
          <div>将视频文件拖入此处，或点击选择视频，自动进入新建项目流程</div>
        </div>
        <h2 style={{ fontSize: 18 }}>最近项目</h2>
        {loading ? (
          <Empty description="加载中…" />
        ) : recent.length === 0 ? (
          <Empty description="还没有项目，拖入一个视频开始吧" />
        ) : (
          <div className="vrs-recent-grid">
            {recent.map((item) => (
              <div
                key={item.dir}
                className="vrs-project-card"
                onClick={() => item.projectValid && openProject(item.dir)}
              >
                <p className="p-title">{item.name}</p>
                <div className="p-meta">
                  <div>视频：{item.videoFileName ?? '未绑定'}</div>
                  <div>记录：{item.recordCount} 条</div>
                  <div>
                    最近打开：
                    {item.lastOpenedAt
                      ? new Date(item.lastOpenedAt).toLocaleString('zh-CN')
                      : '未知'}
                  </div>
                </div>
                <span className={`p-status ${item.videoExists ? 'ok' : 'missing'}`}>
                  {item.projectValid
                    ? item.videoExists
                      ? '视频正常'
                      : '原视频丢失'
                    : '项目已失效'}
                </span>
                <div style={{ marginTop: 8 }}>
                  <Popconfirm
                    title="删除项目目录？"
                    description="项目将移动到应用数据回收目录，可从回收目录恢复。"
                    okText="删除"
                    okButtonProps={{ danger: true }}
                    onConfirm={async (e) => {
                      e?.stopPropagation();
                      try {
                        await projectService.deleteProject(item.dir);
                        message.success('项目已移至回收目录');
                        await loadRecent();
                      } catch (err) {
                        message.error(`删除失败：${describeError(err)}`);
                      }
                    }}
                  >
                    <Button
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    >
                      删除
                    </Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        title="新建项目"
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        width={520}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" initialValues={{ parentDir: '' }}>
          <Form.Item
            name="name"
            label="项目名称"
            rules={[{ required: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如：CS2 对局复盘" />
          </Form.Item>
          <Form.Item name="videoPath" label="视频文件（可稍后绑定）">
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={droppedVideo ?? undefined}
                placeholder="选择或拖入视频"
                onChange={(e) => setDroppedVideo(e.target.value || null)}
              />
              <Button onClick={pickVideo}>选择</Button>
            </Space.Compact>
          </Form.Item>
          <Form.Item name="parentDir" label="项目保存位置">
            <Space.Compact style={{ width: '100%' }}>
              <Input placeholder="留空则保存到文档目录" />
              <Button onClick={pickParentDir}>选择</Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

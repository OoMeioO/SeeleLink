/**
 * IRPage - 红外控制页面
 *
 * 四 Tab 架构：
 * - 设备管理：设备发现 + 连接 + 控制面板
 * - 指令库：全局命令配置（按设备类型）
 * - 序列：命令序列管理
 * - 类型配置：设备类型管理
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTheme, textColorForBg } from '../themes';
import { RefreshCw, Search, Globe, Cable, Smartphone, List, Play, Settings, Loader } from 'lucide-react';
import type { IRDevice, IRCommandDef, IRDeviceType, IRSequence, IRData, ComPortInfo } from '../types';
import type { Theme } from '../themes/types';

interface IRPageProps {
  irData: IRData;
  onIrDataChange: (data: IRData) => void;
}

type IRTab = 'devices' | 'commands' | 'sequences' | 'types';

// Helper: get effective commands for a device (type commands + device custom commands)
function getDeviceCommands(device: IRDevice, data: IRData): IRCommandDef[] {
  const typeCmds = data.commands.filter(c => !c.deviceTypeId || c.deviceTypeId === device.deviceTypeId);
  const customCmds = device.customCommands || [];
  return [...typeCmds, ...customCmds];
}

export const IRPage: React.FC<IRPageProps> = ({ irData: initialData, onIrDataChange }) => {
  const { theme } = useTheme();
  const colors = theme.colors;

  // ── State ──────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<IRTab>('devices');
  const [data, setData] = useState<IRData>(initialData);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Discovery state
  const [scanning, setScanning] = useState(false);
  const [adbDevices, setAdbDevices] = useState<string[]>([]);
  const [serialPorts, setSerialPorts] = useState<string[]>([]);
  const [lanScanProgress, setLanScanProgress] = useState('');
  const [lanDiscovered, setLanDiscovered] = useState<string[]>([]);
  const [lanScanning, setLanScanning] = useState(false);

  // Modal state
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showAddCommand, setShowAddCommand] = useState(false);
  const [showAddType, setShowAddType] = useState(false);
  const [showAddSequence, setShowAddSequence] = useState(false);
  const [editingCommand, setEditingCommand] = useState<IRCommandDef | null>(null);
  const [editingDevice, setEditingDevice] = useState<IRDevice | null>(null);
  const [editingType, setEditingType] = useState<IRDeviceType | null>(null);

  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState('');

  // Sync data from props when it changes
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Persist data changes
  const updateData = useCallback((newData: IRData) => {
    setData(newData);
    onIrDataChange(newData);
  }, [onIrDataChange]);

  // ── Discovery ─────────────────────────────────────────────────────────
  const scanAdbDevices = useCallback(async () => {
    setScanning(true);
    setStatus('扫描 ADB 设备...');
    try {
      const result = await window.electronAPI?.execAdb(['devices']);
      if (result?.ok) {
        const lines = result.stdout.split('\n').filter((l: string) => l.trim() && !l.includes('List of devices'));
        const deviceIds = lines
          .map((l: string) => l.trim().split(/\s+/)[0])
          .filter((id: string) => id && !id.includes('*'));
        setAdbDevices(deviceIds);
        setStatus(`发现 ${deviceIds.length} 个 ADB 设备`);
      } else {
        setStatus('ADB 扫描失败');
      }
    } catch {
      setStatus('ADB 不可用');
    } finally {
      setScanning(false);
    }
  }, []);

  const scanSerialPorts = useCallback(async () => {
    try {
      const ports = await window.electronAPI?.serialList();
      setSerialPorts(ports?.map((p: ComPortInfo) => p.path) || []);
    } catch {
      setSerialPorts([]);
    }
  }, []);

  const scanLanDevices = useCallback(async () => {
    setLanScanning(true);
    setLanScanProgress('正在扫描局域网...');
    setLanDiscovered([]);
    try {
      const result = await window.electronAPI?.androidScanNetwork({ timeout: 2000 });
      if (result?.ok) {
        const discovered = result.devices.map((d) => d.id);
        setLanDiscovered(discovered);
        setLanScanProgress(`发现 ${discovered.length} 个设备 (扫描了 ${result.scanned || 0} 个IP)`);
      } else {
        setLanScanProgress(result?.error || '扫描失败');
      }
    } catch {
      setLanScanProgress('扫描异常');
    } finally {
      setLanScanning(false);
    }
  }, []);

  // ── Device CRUD ───────────────────────────────────────────────────────
  const selectedDevice = data.devices.find(d => d.id === selectedDeviceId) || null;

  const addDevice = useCallback((device: IRDevice) => {
    const newDevice: IRDevice = { ...device, id: `ir-${Date.now()}` };
    updateData({ ...data, devices: [...data.devices, newDevice] });
    setSelectedDeviceId(newDevice.id);
    setShowAddDevice(false);
    setStatus(`已添加设备: ${device.name}`);
  }, [data, updateData]);

  const updateDevice = useCallback((device: IRDevice) => {
    updateData({ ...data, devices: data.devices.map(d => d.id === device.id ? device : d) });
  }, [data, updateData]);

  const deleteDevice = useCallback((id: string) => {
    updateData({ ...data, devices: data.devices.filter(d => d.id !== id) });
    if (selectedDeviceId === id) setSelectedDeviceId(null);
    setStatus('设备已删除');
  }, [data, updateData, selectedDeviceId]);

  // ── Command CRUD ──────────────────────────────────────────────────────
  const addCommand = useCallback((cmd: IRCommandDef) => {
    const newCmd: IRCommandDef = { ...cmd, id: `cmd-${Date.now()}` };
    updateData({ ...data, commands: [...data.commands, newCmd] });
    setShowAddCommand(false);
    setStatus(`已添加命令: ${cmd.name}`);
  }, [data, updateData]);

  const updateCommand = useCallback((cmd: IRCommandDef) => {
    updateData({ ...data, commands: data.commands.map(c => c.id === cmd.id ? cmd : c) });
    setEditingCommand(null);
  }, [data, updateData]);

  const deleteCommand = useCallback((id: string) => {
    updateData({ ...data, commands: data.commands.filter(c => c.id !== id) });
    setStatus('命令已删除');
  }, [data, updateData]);

  // ── Type CRUD ─────────────────────────────────────────────────────────
  const addType = useCallback((type: IRDeviceType) => {
    const newType: IRDeviceType = { ...type, id: `dt-${Date.now()}` };
    updateData({ ...data, deviceTypes: [...data.deviceTypes, newType] });
    setShowAddType(false);
  }, [data, updateData]);

  const updateType = useCallback((type: IRDeviceType) => {
    updateData({ ...data, deviceTypes: data.deviceTypes.map(t => t.id === type.id ? type : t) });
    setEditingType(null);
  }, [data, updateData]);

  const deleteType = useCallback((id: string) => {
    // Also remove commands of this type
    updateData({
      ...data,
      deviceTypes: data.deviceTypes.filter(t => t.id !== id),
      commands: data.commands.filter(c => c.deviceTypeId !== id),
    });
    setStatus('类型已删除');
  }, [data, updateData]);

  // ── Sequence CRUD ─────────────────────────────────────────────────────
  const addSequence = useCallback((seq: IRSequence) => {
    const newSeq: IRSequence = { ...seq, id: `seq-${Date.now()}` };
    updateData({ ...data, sequences: [...data.sequences, newSeq] });
    setShowAddSequence(false);
  }, [data, updateData]);

  const updateSequence = useCallback((seq: IRSequence) => {
    updateData({ ...data, sequences: data.sequences.map(s => s.id === seq.id ? seq : s) });
  }, [data, updateData]);

  const deleteSequence = useCallback((id: string) => {
    updateData({ ...data, sequences: data.sequences.filter(s => s.id !== id) });
    setStatus('序列已删除');
  }, [data, updateData]);

  // ── Send IR Command ───────────────────────────────────────────────────
  const sendCommand = useCallback(async (cmd: IRCommandDef, device: IRDevice) => {
    if (sending) return;
    setSending(true);
    setStatus(`发送: ${cmd.name}...`);
    try {
      if (device.connectionType === 'usb-serial') {
        // Send via serial port - encode pattern as hex string
        const payload = cmd.pattern || 'AA BB CC DD';
        await window.electronAPI?.serialExecute(device.port || device.id, payload);
        setStatus(`已发送 [串口]: ${cmd.name}`);
      } else if (device.connectionType === 'usb-adb' || device.connectionType === 'network-adb') {
        // Send via ADB - use shell to send IR command
        // Most Android phones with IR blaster use:
        // adb shell am broadcast -a com.irremote.transmit --es hex_string 'PATTERN'
        const pattern = cmd.pattern || '0000';
        const result = await window.electronAPI?.execAdb([
          '-s', device.adbDeviceId || device.id,
          'shell', 'am', 'broadcast', '-a', 'com.irremote.transmit',
          '--es', 'hex_string', pattern
        ]);
        if (result?.ok) {
          setStatus(`已发送 [ADB]: ${cmd.name}`);
        } else {
          // Non-standard API — most Android devices require custom ROM/IR app to support this broadcast action
          setStatus(`发送失败: ${result?.error || result?.stderr || '未知错误'} (红外广播依赖设备ROM支持，标准Android系统可能不支持)`);
        }
      }
    } catch (e) {
      setStatus(`发送失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  }, [sending]);

  // ── Send Sequence ────────────────────────────────────────────────────
  const sendSequence = useCallback(async (seq: IRSequence, device: IRDevice) => {
    if (sending) return;
    setSending(true);
    setStatus(`执行序列: ${seq.name}...`);
    try {
      for (const step of seq.steps) {
        const cmd = data.commands.find(c => c.id === step.commandId);
        if (!cmd) continue;
        setStatus(`发送: ${cmd.name}...`);
        if (device.connectionType === 'usb-serial') {
          await window.electronAPI?.serialExecute(device.port || device.id, cmd.pattern || '');
        } else if (device.connectionType === 'usb-adb' || device.connectionType === 'network-adb') {
          const pattern = cmd.pattern || '0000';
          await window.electronAPI?.execAdb([
            '-s', device.adbDeviceId || device.id,
            'shell', 'am', 'broadcast', '-a', 'com.irremote.transmit',
            '--es', 'hex_string', pattern
          ]);
        }
        if (step.delayMs > 0) {
          await new Promise(r => setTimeout(r, step.delayMs));
        }
      }
      setStatus(`序列完成: ${seq.name}`);
    } catch (e) {
      setStatus(`执行失败: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  }, [sending, data.commands]);

  // ── Get device commands ───────────────────────────────────────────────
  const getDeviceCommands = useCallback((device: IRDevice): IRCommandDef[] => {
    const typeCmds = data.commands.filter(c => !c.deviceTypeId || c.deviceTypeId === device.deviceTypeId);
    const customCmds = device.customCommands || [];
    return [...typeCmds, ...customCmds];
  }, [data.commands]);

  // ── Layout helpers ────────────────────────────────────────────────────
  // btnTextColor: auto-contrasting text color based on background luminance
  const btnTextColor = (bg: string) => textColorForBg(bg);

  // coloredBtn: helper for buttons with colored backgrounds
  const coloredBtn = (bg: string, extra?: React.CSSProperties) => ({
    padding: '6px 12px', background: bg, color: btnTextColor(bg),
    border: '1px solid transparent', borderRadius: 4, cursor: 'pointer', fontSize: 12, ...extra,
  });

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    background: colors.bgTertiary,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  };

  const cardStyle: React.CSSProperties = {
    background: colors.bgSecondary,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
  };

  // ── Render: Tab Bar ───────────────────────────────────────────────────
  const tabItems: { id: IRTab; label: string; icon: React.ReactNode }[] = [
    { id: 'devices', label: '设备管理', icon: <Smartphone size={14} style={{ verticalAlign: 'middle' }} /> },
    { id: 'commands', label: '指令库', icon: <List size={14} style={{ verticalAlign: 'middle' }} /> },
    { id: 'sequences', label: '序列', icon: <Play size={14} style={{ verticalAlign: 'middle' }} /> },
    { id: 'types', label: '类型配置', icon: <Settings size={14} style={{ verticalAlign: 'middle' }} /> },
  ];

  // ── Render: Device Commands Panel ────────────────────────────────────
  const renderCommandsPanel = (device: IRDevice) => {
    const cmds = getDeviceCommands(device);
    const type = data.deviceTypes.find(t => t.id === device.deviceTypeId);

    return (
      <div>
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontWeight: 600, color: colors.text }}>{type?.name || '未知类型'}</span>
          <span style={{ fontSize: 12, color: colors.textSecondary, marginLeft: 8 }}>
            {device.connectionType === 'usb-serial' ? `串口: ${device.port}` : `ADB: ${device.adbDeviceId}`}
          </span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {cmds.map(cmd => (
            <button
              key={cmd.id}
              onClick={() => sendCommand(cmd, device)}
              disabled={sending}
              style={{
                padding: '10px 18px',
                background: colors.bgTertiary,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 6,
                cursor: sending ? 'not-allowed' : 'pointer',
                fontSize: 13,
                minWidth: 72,
                textAlign: 'center',
                opacity: sending ? 0.5 : 1,
              }}
              title={cmd.description || cmd.pattern || ''}
            >
              {cmd.name}
            </button>
          ))}
          {cmds.length === 0 && (
            <div style={{ color: colors.textTertiary, fontSize: 12 }}>
              该设备类型暂无命令，请到「指令库」添加
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── Render: Tab Content ────────────────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'devices':
        return (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* Left: Discovery */}
            <div style={{ width: 300, borderRight: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', background: colors.bgSecondary }}>
              <div style={{ padding: '10px 16px', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: colors.text }}>设备发现</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button onClick={scanAdbDevices} disabled={scanning} style={{ ...btnStyle, background: colors.primary, color: btnTextColor(colors.primary) }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>{scanning ? '...' : <><RefreshCw size={13} style={{ verticalAlign: 'middle' }} /> 扫描 ADB 设备</>}</span>
                  </button>
                  <button onClick={scanSerialPorts} style={{ ...btnStyle }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Cable size={13} style={{ verticalAlign: 'middle' }} /> 扫描串口</span>
                  </button>
                  <button onClick={scanLanDevices} disabled={lanScanning} style={{ ...btnStyle, background: lanScanning ? colors.textTertiary : colors.success, color: btnTextColor(lanScanning ? colors.textTertiary : colors.success) }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Globe size={13} style={{ verticalAlign: 'middle' }} /> {lanScanning ? '扫描中...' : '局域网发现'}</span>
                  </button>
                </div>
              </div>

              {/* ADB Devices */}
              {adbDevices.length > 0 && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>🔗 ADB 设备</div>
                  {adbDevices.map(id => {
                    const existing = data.devices.find(d => d.adbDeviceId === id);
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ fontSize: 12, color: colors.text, fontFamily: 'monospace' }}>{id}</span>
                        {existing ? (
                          <span style={{ fontSize: 10, color: colors.success }}>已添加</span>
                        ) : (
                          <button
                            onClick={() => { scanAdbDevices(); setShowAddDevice(true); }}
                            style={coloredBtn(colors.primary, { fontSize: 10, padding: '2px 8px', borderRadius: 3 })}
                          >+ 添加</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Serial Ports */}
              {serialPorts.length > 0 && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Cable size={11} style={{ verticalAlign: 'middle' }} /> 串口</div>
                  {serialPorts.map(port => {
                    const existing = data.devices.find(d => d.port === port);
                    return (
                      <div key={port} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ fontSize: 12, color: colors.text, fontFamily: 'monospace' }}>{port}</span>
                        {existing ? (
                          <span style={{ fontSize: 10, color: colors.success }}>已添加</span>
                        ) : (
                          <button
                            onClick={() => { scanSerialPorts(); setShowAddDevice(true); }}
                            style={coloredBtn(colors.primary, { fontSize: 10, padding: '2px 8px', borderRadius: 3 })}
                          >+ 添加</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LAN Discovered */}
              {lanDiscovered.length > 0 && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Globe size={11} style={{ verticalAlign: 'middle' }} /> 局域网</div>
                  {lanDiscovered.map(id => {
                    const existing = data.devices.find(d => d.adbDeviceId === id);
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span style={{ fontSize: 12, color: colors.text, fontFamily: 'monospace' }}>{id}</span>
                        {existing ? (
                          <span style={{ fontSize: 10, color: colors.success }}>已添加</span>
                        ) : (
                          <button
                            onClick={() => { setShowAddDevice(true); }}
                            style={coloredBtn(colors.success, { fontSize: 10, padding: '2px 8px', borderRadius: 3 })}
                          >+ 连接</button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* LAN Scan Progress */}
              {lanScanProgress && lanScanning && (
                <div style={{ padding: '8px 16px', borderBottom: `1px solid ${colors.border}`, fontSize: 11, color: colors.primary }}>
                  <Loader size={11} style={{ verticalAlign: 'middle', animation: 'spin 1s linear infinite' }} /> {lanScanProgress}
                </div>
              )}

              {/* Status */}
              {status && (
                <div style={{ padding: '6px 16px', borderBottom: `1px solid ${colors.border}`, fontSize: 11, color: colors.textSecondary }}>
                  {status}
                </div>
              )}

              {/* Add Device Button */}
              <div style={{ padding: '12px 16px', marginTop: 'auto' }}>
                <button
                  onClick={() => setShowAddDevice(true)}
                  style={coloredBtn(colors.primary, { width: '100%', padding: '8px 12px', fontSize: 13 })}
                >
                  + 添加设备
                </button>
              </div>
            </div>

            {/* Right: Device List + Control */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Device List */}
              <div style={{ padding: 12, borderBottom: `1px solid ${colors.border}`, overflow: 'auto', maxHeight: 240 }}>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8, fontWeight: 500 }}>
                  已配置设备 ({data.devices.length})
                </div>
                {data.devices.length === 0 ? (
                  <div style={{ color: colors.textTertiary, fontSize: 12, textAlign: 'center', padding: 20 }}>
                    暂无设备，请从左侧添加
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {data.devices.map(device => {
                      const type = data.deviceTypes.find(t => t.id === device.deviceTypeId);
                      return (
                        <div
                          key={device.id}
                          onClick={() => setSelectedDeviceId(device.id)}
                          style={{
                            padding: '8px 14px',
                            background: selectedDeviceId === device.id ? colors.primary : colors.bgTertiary,
                            border: `1px solid ${selectedDeviceId === device.id ? colors.primary : colors.border}`,
                            borderRadius: 6,
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            minWidth: 120,
                          }}
                        >
                          <div style={{ fontSize: 12, fontWeight: 500, color: btnTextColor(selectedDeviceId === device.id ? colors.primary : colors.bgTertiary) }}>{device.name}</div>
                          <div style={{ fontSize: 10, color: selectedDeviceId === device.id ? 'rgba(255,255,255,0.8)' : colors.textSecondary }}>
                            {type?.name || '未分类'} • {device.connectionType === 'usb-serial' ? '串口' : 'ADB'}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteDevice(device.id); }}
                            style={coloredBtn(colors.error, { fontSize: 10, padding: '1px 6px', borderRadius: 3, marginTop: 4, alignSelf: 'flex-start' })}
                          >删除</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Control Panel */}
              <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
                {selectedDevice ? (
                  renderCommandsPanel(selectedDevice)
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: colors.textTertiary }}>
                    点击左侧设备进行控制
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'commands':
        return (
          <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: colors.text }}>指令库</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textSecondary }}>
                  全局命令库，按设备类型分组。设备关联类型后自动获得对应命令。
                </p>
              </div>
              <button onClick={() => setShowAddCommand(true)} style={coloredBtn(colors.primary)}>+ 添加指令</button>
            </div>
            {data.deviceTypes.map(dt => {
              const cmds = data.commands.filter(c => c.deviceTypeId === dt.id || !c.deviceTypeId);
              if (cmds.length === 0) return null;
              return (
                <div key={dt.id} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary, marginBottom: 8 }}>{dt.name} ({dt.category})</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cmds.map(cmd => (
                      <div
                        key={cmd.id}
                        style={{
                          padding: '8px 14px',
                          background: colors.bgSecondary,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 6,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          minWidth: 140,
                        }}
                      >
                        <div style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>{cmd.name}</div>
                        <div style={{ fontSize: 10, color: colors.textSecondary }}>{cmd.description || cmd.pattern || '—'}</div>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          <button onClick={() => setEditingCommand(cmd)} style={{ fontSize: 10, padding: '2px 8px', background: colors.bgTertiary, color: colors.text, border: 'none', borderRadius: 3, cursor: 'pointer' }}>编辑</button>
                          <button onClick={() => deleteCommand(cmd.id)} style={coloredBtn(colors.error, { fontSize: 10, padding: '2px 8px', borderRadius: 3 })}>删除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        );

      case 'sequences':
        return (
          <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: colors.text }}>指令序列</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textSecondary }}>
                  创建序列，配置多个命令的执行顺序和间隔。
                </p>
              </div>
              <button onClick={() => setShowAddSequence(true)} style={coloredBtn(colors.primary)}>+ 创建序列</button>
            </div>
            {data.sequences.length === 0 ? (
              <div style={{ textAlign: 'center', color: colors.textTertiary, padding: 40, fontSize: 13 }}>暂无序列</div>
            ) : (
              data.sequences.map(seq => {
                const device = data.devices.find(d => d.id === seq.deviceId);
                return (
                  <div key={seq.id} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 500, color: colors.text }}>{seq.name}</div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {device && (
                          <button
                            onClick={() => sendSequence(seq, device)}
                            disabled={sending}
                            style={{ ...btnStyle, background: colors.success, color: btnTextColor(colors.success), opacity: sending ? 0.5 : 1 }}
                          ><Play size={12} style={{ marginRight: 4 }} />执行</button>
                        )}
                        <button onClick={() => deleteSequence(seq.id)} style={coloredBtn(colors.error, { padding: '6px 12px', fontSize: 12 })}>删除</button>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
                      设备: {device?.name || '未知'}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textTertiary }}>
                      {seq.steps.map((step, i) => {
                        const cmd = data.commands.find(c => c.id === step.commandId);
                        return (
                          <span key={i}>
                            {cmd?.name || '未知'}
                            {step.delayMs > 0 && <span style={{ color: colors.primary }}> (+{step.delayMs}ms)</span>}
                            {i < seq.steps.length - 1 && ' → '}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );

      case 'types':
        return (
          <div style={{ padding: 20, overflow: 'auto', height: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: colors.text }}>类型配置</h3>
                <p style={{ margin: '4px 0 0', fontSize: 12, color: colors.textSecondary }}>
                  设备类型定义，每个类型关联一组默认命令。
                </p>
              </div>
              <button onClick={() => setShowAddType(true)} style={coloredBtn(colors.primary)}>+ 添加类型</button>
            </div>
            {data.deviceTypes.map(dt => {
              const cmdCount = data.commands.filter(c => c.deviceTypeId === dt.id).length;
              const deviceCount = data.devices.filter(d => d.deviceTypeId === dt.id).length;
              return (
                <div key={dt.id} style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 500, color: colors.text }}>{dt.name}</div>
                      <div style={{ fontSize: 11, color: colors.textSecondary }}>{dt.category} • {cmdCount} 个命令 • {deviceCount} 个设备</div>
                      {dt.description && <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>{dt.description}</div>}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setEditingType(dt)} style={{ ...btnStyle, fontSize: 11 }}>编辑</button>
                      <button onClick={() => deleteType(dt.id)} style={coloredBtn(colors.error, { fontSize: 11, padding: '6px 12px' })}>删除</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: colors.bg, color: colors.text }}>
      {/* Tab Bar */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}`, background: colors.bgSecondary }}>
        {tabItems.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 20px',
              background: activeTab === tab.id ? colors.primary : 'transparent',
              color: colors.text,
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${colors.primary}` : '2px solid transparent',
              cursor: 'pointer',
              fontSize: 13,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {renderContent()}
      </div>

      {/* Modals */}
      {showAddDevice && (
        <AddDeviceModal
          data={data}
          adbDevices={adbDevices}
          serialPorts={serialPorts}
          lanDiscovered={lanDiscovered}
          onAdd={addDevice}
          onClose={() => setShowAddDevice(false)}
        />
      )}
      {showAddCommand && (
        <AddCommandModal
          deviceTypes={data.deviceTypes}
          onAdd={addCommand}
          onClose={() => setShowAddCommand(false)}
        />
      )}
      {editingCommand && (
        <AddCommandModal
          deviceTypes={data.deviceTypes}
          initial={editingCommand}
          onAdd={updateCommand}
          onClose={() => setEditingCommand(null)}
        />
      )}
      {showAddType && (
        <AddTypeModal
          onAdd={addType}
          onClose={() => setShowAddType(false)}
        />
      )}
      {editingType && (
        <AddTypeModal
          initial={editingType}
          onAdd={updateType}
          onClose={() => setEditingType(null)}
        />
      )}
      {showAddSequence && (
        <AddSequenceModal
          devices={data.devices}
          commands={data.commands}
          onAdd={addSequence}
          onClose={() => setShowAddSequence(false)}
        />
      )}
    </div>
  );
};

// ============================================================
// Sub-Modals
// ============================================================

function AddDeviceModal({ data, adbDevices, serialPorts, lanDiscovered, onAdd, onClose }: {
  data: IRData;
  adbDevices: string[];
  serialPorts: string[];
  lanDiscovered: string[];
  onAdd: (d: IRDevice) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [name, setName] = useState('');
  const [connType, setConnType] = useState<'usb-serial' | 'usb-adb' | 'network-adb'>('usb-adb');
  const [port, setPort] = useState('');
  const [adbDeviceId, setAdbDeviceId] = useState('');
  const [deviceTypeId, setDeviceTypeId] = useState(data.deviceTypes[0]?.id || '');

  const availableAdb = [...adbDevices, ...lanDiscovered];

  return (
    <Modal title="添加 IR 设备" onClose={onClose} theme={theme}>
      <Field label="设备名称">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="如：客厅空调" style={inputStyle(theme)} />
      </Field>
      <Field label="连接方式">
        <select value={connType} onChange={e => setConnType(e.target.value as any)} style={inputStyle(theme)}>
          <option value="usb-adb">USB ADB (手机内置红外)</option>
          <option value="network-adb">网络 ADB (无线调试)</option>
          <option value="usb-serial">USB 串口 (外置 IR 控制器)</option>
        </select>
      </Field>
      {(connType === 'usb-adb' || connType === 'network-adb') && (
        <Field label="ADB 设备">
          <select value={adbDeviceId} onChange={e => setAdbDeviceId(e.target.value)} style={inputStyle(theme)}>
            <option value="">选择设备...</option>
            {availableAdb.map(id => <option key={id} value={id}>{id}</option>)}
          </select>
        </Field>
      )}
      {connType === 'usb-serial' && (
        <Field label="串口">
          <select value={port} onChange={e => setPort(e.target.value)} style={inputStyle(theme)}>
            <option value="">选择端口...</option>
            {serialPorts.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </Field>
      )}
      <Field label="设备类型">
        <select value={deviceTypeId} onChange={e => setDeviceTypeId(e.target.value)} style={inputStyle(theme)}>
          {data.deviceTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name} ({dt.category})</option>)}
        </select>
      </Field>
      <ModalFooter>
        <button onClick={onClose} style={{ ...btnBase(theme), background: colors.bgTertiary }}>取消</button>
        <button
          onClick={() => {
            if (!name.trim()) return;
            onAdd({ id: '', name: name.trim(), connectionType: connType, port: connType === 'usb-serial' ? port : undefined, adbDeviceId: (connType === 'usb-adb' || connType === 'network-adb') ? adbDeviceId : undefined, deviceTypeId });
          }}
          disabled={!name.trim() || (connType !== 'usb-serial' && !adbDeviceId) || (connType === 'usb-serial' && !port)}
          style={coloredBtn(colors.primary, { padding: '7px 16px', fontSize: 13 })}
        >添加</button>
      </ModalFooter>
    </Modal>
  );
}

function AddCommandModal({ deviceTypes, initial, onAdd, onClose }: {
  deviceTypes: IRDeviceType[];
  initial?: IRCommandDef;
  onAdd: (c: IRCommandDef) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [deviceTypeId, setDeviceTypeId] = useState(initial?.deviceTypeId || '');
  const [frequency, setFrequency] = useState(initial?.frequency?.toString() || '38000');
  const [pattern, setPattern] = useState(initial?.pattern || '');
  const [protocol, setProtocol] = useState(initial?.protocol || 'nec');
  const [repeat, setRepeat] = useState(initial?.repeat?.toString() || '1');
  const [description, setDescription] = useState(initial?.description || '');

  const handleAdd = () => {
    if (!name.trim() || !category.trim()) return;
    onAdd({
      id: initial?.id || '',
      name: name.trim(),
      category: category.trim(),
      deviceTypeId: deviceTypeId || undefined,
      frequency: frequency ? parseInt(frequency) : undefined,
      pattern: pattern || undefined,
      protocol: protocol || undefined,
      repeat: repeat ? parseInt(repeat) : undefined,
      description: description || undefined,
    });
  };

  return (
    <Modal title={initial ? '编辑指令' : '添加指令'} onClose={onClose} theme={theme}>
      <Field label="指令名称"><input value={name} onChange={e => setName(e.target.value)} placeholder="如：电源、制冷" style={inputStyle(theme)} /></Field>
      <Field label="类别">
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle(theme)}>
          <option value="">选择类别...</option>
          {['空调', '电视', '风扇', '机顶盒', '投影仪', '音响', '其他'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="设备类型">
        <select value={deviceTypeId} onChange={e => setDeviceTypeId(e.target.value)} style={inputStyle(theme)}>
          <option value="">全局（所有类型）</option>
          {deviceTypes.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
        </select>
      </Field>
      <Field label="频率 (Hz)"><input value={frequency} onChange={e => setFrequency(e.target.value)} placeholder="38000" style={inputStyle(theme)} /></Field>
      <Field label="Pattern (编码数据)"><input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="十六进制编码字符串" style={inputStyle(theme)} /></Field>
      <Field label="协议">
        <select value={protocol} onChange={e => setProtocol(e.target.value)} style={inputStyle(theme)}>
          <option value="nec">NEC</option>
          <option value="rc5">RC5</option>
          <option value="rc6">RC6</option>
          <option value="sony">Sony</option>
          <option value="raw">Raw</option>
        </select>
      </Field>
      <Field label="重复次数"><input value={repeat} onChange={e => setRepeat(e.target.value)} placeholder="1" style={inputStyle(theme)} /></Field>
      <Field label="说明"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选说明" style={inputStyle(theme)} /></Field>
      <ModalFooter>
        <button onClick={onClose} style={{ ...btnBase(theme), background: colors.bgTertiary }}>取消</button>
        <button onClick={handleAdd} disabled={!name.trim() || !category.trim()} style={coloredBtn(colors.primary, { padding: '7px 16px', fontSize: 13 })}>{initial ? '保存' : '添加'}</button>
      </ModalFooter>
    </Modal>
  );
}

function AddTypeModal({ initial, onAdd, onClose }: {
  initial?: IRDeviceType;
  onAdd: (t: IRDeviceType) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [description, setDescription] = useState(initial?.description || '');

  return (
    <Modal title={initial ? '编辑类型' : '添加类型'} onClose={onClose} theme={theme}>
      <Field label="类型名称"><input value={name} onChange={e => setName(e.target.value)} placeholder="如：格力空调" style={inputStyle(theme)} /></Field>
      <Field label="类别">
        <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle(theme)}>
          <option value="">选择类别...</option>
          {['空调', '电视', '风扇', '机顶盒', '投影仪', '音响', '其他'].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="说明"><input value={description} onChange={e => setDescription(e.target.value)} placeholder="可选说明" style={inputStyle(theme)} /></Field>
      <ModalFooter>
        <button onClick={onClose} style={{ ...btnBase(theme), background: colors.bgTertiary }}>取消</button>
        <button onClick={() => { if (name.trim() && category.trim()) onAdd({ id: initial?.id || '', name: name.trim(), category: category.trim(), description: description || undefined }); }} disabled={!name.trim() || !category.trim()} style={coloredBtn(colors.primary, { padding: '7px 16px', fontSize: 13 })}>{initial ? '保存' : '添加'}</button>
      </ModalFooter>
    </Modal>
  );
}

function AddSequenceModal({ devices, commands, onAdd, onClose }: {
  devices: IRDevice[];
  commands: IRCommandDef[];
  onAdd: (s: IRSequence) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const colors = theme.colors;
  const [name, setName] = useState('');
  const [deviceId, setDeviceId] = useState(devices[0]?.id || '');
  const [steps, setSteps] = useState<{ commandId: string; delayMs: number }[]>([]);

  const addStep = () => {
    setSteps([...steps, { commandId: commands[0]?.id || '', delayMs: 0 }]);
  };

  const removeStep = (i: number) => {
    setSteps(steps.filter((_, idx) => idx !== i));
  };

  const updateStep = (i: number, field: 'commandId' | 'delayMs', value: string | number) => {
    setSteps(steps.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    if (!name.trim() || !deviceId || steps.length === 0) return;
    onAdd({ id: '', name: name.trim(), deviceId, steps });
  };

  return (
    <Modal title="创建序列" onClose={onClose} theme={theme}>
      <Field label="序列名称"><input value={name} onChange={e => setName(e.target.value)} placeholder="如：开空调-制冷25度" style={inputStyle(theme)} /></Field>
      <Field label="目标设备">
        <select value={deviceId} onChange={e => setDeviceId(e.target.value)} style={inputStyle(theme)}>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </Field>
      <Field label="步骤">
        {steps.map((step, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <select value={step.commandId} onChange={e => updateStep(i, 'commandId', e.target.value)} style={{ ...inputStyle(theme), flex: 2 }}>
              {commands.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" value={step.delayMs} onChange={e => updateStep(i, 'delayMs', parseInt(e.target.value) || 0)} placeholder="延迟ms" style={{ ...inputStyle(theme), flex: 1 }} />
            <button onClick={() => removeStep(i)} style={coloredBtn(colors.error, { padding: '4px 10px', fontSize: 13 })}>×</button>
          </div>
        ))}
        <button onClick={addStep} style={{ ...btnBase(theme), marginTop: 4 }}>+ 添加步骤</button>
      </Field>
      <ModalFooter>
        <button onClick={onClose} style={{ ...btnBase(theme), background: colors.bgTertiary }}>取消</button>
        <button onClick={handleSave} disabled={!name.trim() || !deviceId || steps.length === 0} style={coloredBtn(colors.primary, { padding: '7px 16px', fontSize: 13 })}>创建</button>
      </ModalFooter>
    </Modal>
  );
}

// ============================================================
// Modal / Field Helpers
// ============================================================

function Modal({ title, onClose, theme, children }: { title: string; onClose: () => void; theme: Theme; children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: colors.bgSecondary, border: `1px solid ${colors.border}`, borderRadius: 8, padding: 20, width: 420, maxHeight: '80vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ fontWeight: 600, fontSize: 15, color: colors.text, marginBottom: 16 }}>{title}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 500, color: '#999', marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
      {children}
    </div>
  );
}

function inputStyle(theme: Theme): React.CSSProperties {
  return {
    width: '100%',
    padding: '8px 10px',
    background: colors.bg,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 4,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
  };
}

function btnBase(theme: Theme): React.CSSProperties {
  return {
    padding: '7px 16px',
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 13,
  };
}

export default IRPage;

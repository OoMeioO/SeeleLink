/**
 * AndroidPage - Android device connection and control page
 *
 * Features:
 * - USB device listing via adb
 * - WiFi ADB LAN discovery (scan local subnet for devices)
 * - Device screenshot display
 * - Touch controls (tap, swipe)
 * - Key events (back, home, recent)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme, textColorForBg } from '../themes';
import { RefreshCw, Wifi, Cable, Plus, AlertTriangle, Smartphone, Loader, Search, WifiOff, X, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, CornerDownLeft, Home, LayoutGrid } from 'lucide-react';
import type { AndroidDevice } from '../types';

interface NetworkInterface {
  name: string;
  ip: string;
  netmask: string;
  mac: string;
}

export interface ConnectionTab {
  id: string;
  deviceId: string;
  device: AndroidDevice;
  screenshot?: string;
}

interface AndroidPageProps {
  androidTabs: ConnectionTab[];
  setAndroidTabs: React.Dispatch<React.SetStateAction<ConnectionTab[]>>;
  androidActiveTab: ConnectionTab | null;
  setAndroidActiveTab: (tab: ConnectionTab | null) => void;
}

// Helper to determine if device ID is network type
function isNetworkDevice(deviceId: string): boolean {
  return deviceId.includes(':') || deviceId.includes('._adb-tls-connect._tcp');
}

// Helper to parse device info from adb devices -l output
function parseDeviceInfo(line: string): Partial<AndroidDevice> {
  const info: Partial<AndroidDevice> = { status: 'connected' };

  const modelMatch = line.match(/model:(\S+)/);
  if (modelMatch) info.model = modelMatch[1].replace(/_/g, ' ');

  const productMatch = line.match(/product:(\S+)/);
  if (productMatch) info.product = productMatch[1];

  const deviceMatch = line.match(/device:(\S+)/);
  if (deviceMatch) {
    if (deviceMatch[1] === 'unauthorized') {
      info.status = 'unauthorized';
    } else if (deviceMatch[1] === 'offline') {
      info.status = 'disconnected';
    }
  }

  const usbMatch = line.match(/usb:([^\s]+)/);
  if (usbMatch) info.serial = usbMatch[1];

  return info;
}

export const AndroidPage: React.FC<AndroidPageProps> = ({
  androidTabs: tabs,
  setAndroidTabs: setTabs,
  androidActiveTab: activeTab,
  setAndroidActiveTab: setActiveTab,
}) => {
  const { theme } = useTheme();
  const [usbDevices, setUsbDevices] = useState<AndroidDevice[]>([]);
  const [networkDevices, setNetworkDevices] = useState<AndroidDevice[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<number>(3000);
  const [manualIp, setManualIp] = useState<string>('');
  const [localIps, setLocalIps] = useState<NetworkInterface[]>([]);
  const [lanScanning, setLanScanning] = useState(false);
  const [lanScanProgress, setLanScanProgress] = useState<string>('');
  const [lanDiscoveredDevices, setLanDiscoveredDevices] = useState<AndroidDevice[]>([]);
  const [lanScanCount, setLanScanCount] = useState(0);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scanTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // P1-10 fix: use refs to avoid stale closures in auto-refresh and scanDevices
  const activeTabRef = useRef(activeTab);
  const lanDiscoveredDevicesRef = useRef(lanDiscoveredDevices);
  const manualIpRef = useRef(manualIp);
  activeTabRef.current = activeTab;
  lanDiscoveredDevicesRef.current = lanDiscoveredDevices;
  manualIpRef.current = manualIp;

  // Execute adb command via IPC
  const execAdb = useCallback(async (args: string[]): Promise<string> => {
    if (!window.electronAPI?.execAdb) return Promise.reject(new Error('execAdb not available'));
    try {
      const result = await window.electronAPI.execAdb(args);
      if (result.ok) return result.stdout;
      else throw new Error(result.error || result.stderr || `exit code ${result.code}`);
    } catch (e: any) {
      throw new Error(e.message || 'adb command failed');
    }
  }, []);

  // Get device properties (model, manufacturer, etc)
  const getDeviceProperties = useCallback(async (deviceId: string): Promise<Partial<AndroidDevice>> => {
    try {
      const modelOut = await execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.model']);
      const manufacturerOut = await execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.product.manufacturer']);
      const versionOut = await execAdb(['-s', deviceId, 'shell', 'getprop', 'ro.build.version.release']);

      return {
        model: modelOut.trim() || undefined,
        manufacturer: manufacturerOut.trim() || undefined,
        version: versionOut.trim() || undefined,
      };
    } catch {
      return {};
    }
  }, [execAdb]);

  // Fetch and cache local IP addresses
  const fetchLocalIps = useCallback(async () => {
    if (!window.electronAPI?.androidGetLocalIp) return;
    try {
      const result = await window.electronAPI.androidGetLocalIp();
      if (result.ok && result.ips) {
        setLocalIps(result.ips);
      }
    } catch {}
  }, []);

  // Scan for all devices (USB and Network) via adb
  const scanDevices = useCallback(async () => {
    setScanning(true);
    setError('');
    try {
      const output = await execAdb(['devices', '-l']);
      const usbList: AndroidDevice[] = [];
      const networkList: AndroidDevice[] = [];

      const lines = output.split('\n').filter((l: string) => l.trim() && !l.includes('List of devices'));

      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 2) continue;

        const deviceId = parts[0];
        const status = parts[1];

        if (status !== 'device' && status !== 'unauthorized' && status !== 'offline') continue;

        // P1-11 fix: use ref to always read current lanDiscoveredDevices value
        const alreadyDiscovered = lanDiscoveredDevicesRef.current.some(d => d.id === deviceId);

        const isNetwork = isNetworkDevice(deviceId);
        const baseInfo = parseDeviceInfo(line);

        const device: AndroidDevice = {
          id: deviceId,
          type: isNetwork ? 'network' : 'usb',
          status: baseInfo.status || 'connected',
          model: baseInfo.model,
          manufacturer: baseInfo.manufacturer,
          product: baseInfo.product,
          serial: baseInfo.serial,
        };

        const ipPortMatch = deviceId.match(/^(\d+\.\d+\.\d+\.\d+):(\d+)$/);
        if (isNetwork && ipPortMatch) {
          device.ip = ipPortMatch[1];
          device.port = parseInt(ipPortMatch[2], 10);
        } else if (isNetwork && deviceId.includes('._adb-tls-connect._tcp')) {
          device.ip = deviceId;
        }

        if (alreadyDiscovered) continue;

        if (isNetwork) {
          networkList.push(device);
        } else {
          usbList.push(device);
        }
      }

      setUsbDevices(usbList);
      setNetworkDevices(networkList);
    } catch (e: any) {
      console.error('Scan error:', e);
      setError('扫描失败: ' + e.message);
    } finally {
      setScanning(false);
    }
  }, [execAdb]);

  // ── LAN Discovery ────────────────────────────────────────────────────────
  const handleLanDiscovery = useCallback(async () => {
    if (lanScanning) return;

    setLanScanning(true);
    setLanScanProgress('正在获取本机IP...');
    setLanDiscoveredDevices([]);
    setLanScanCount(0);
    setError('');

    try {
      // Get local IPs
      const localIpResult = await window.electronAPI?.androidGetLocalIp();
      if (!localIpResult?.ok || !localIpResult.ips?.length) {
        setLanScanProgress('');
        setError('未找到本机IP，请确保已连接网络');
        setLanScanning(false);
        return;
      }
      setLocalIps(localIpResult.ips);

      if (localIpResult.ips.length > 1) {
        setLanScanProgress(`发现 ${localIpResult.ips.length} 个网卡，逐一扫描...`);
      } else {
        setLanScanProgress(`正在扫描 ${localIpResult.ips[0].ip} 所在网段...`);
      }

      // Run network scan
      const result = await window.electronAPI?.androidScanNetwork({ timeout: 2000 });

      if (!result?.ok) {
        setLanScanProgress('');
        setError(result?.error || '扫描失败');
        setLanScanning(false);
        return;
      }

      setLanScanCount(result.scanned || 0);

      if (!result.devices || result.devices.length === 0) {
        setLanScanProgress(`扫描完成，未发现Android设备 (扫描了 ${result.scanned || 0} 个IP)`);
        setLanScanning(false);
        return;
      }

      // Get already-paired network devices to avoid duplicates
      const pairedIps = new Set(
        networkDevices
          .filter(d => d.ip)
          .map(d => `${d.ip}:${d.port || 5555}`)
      );

      // Filter: only keep discovered + unauthorized devices, skip already-paired
      const filtered = result.devices.filter(d => !pairedIps.has(d.id));

      const discovered = filtered
        .filter(d => d.status === 'discovered')
        .map(d => ({
          id: d.id,
          type: 'network' as const,
          ip: d.ip,
          port: d.port,
          status: 'discovered' as const,
          model: d.model,
          manufacturer: d.manufacturer,
          version: d.version,
        }));

      const unauthorized = filtered
        .filter(d => d.status === 'unauthorized')
        .map(d => ({
          id: d.id,
          type: 'network' as const,
          ip: d.ip,
          port: d.port,
          status: 'unauthorized' as const,
          model: d.model || d.ip,
          error: d.error,
        }));

      const all = [...discovered, ...unauthorized];
      setLanDiscoveredDevices(all);

      const dCount = discovered.length;
      const uCount = unauthorized.length;
      let msg = `扫描完成`;
      if (dCount > 0) msg += `，发现 ${dCount} 台Android设备`;
      if (uCount > 0) msg += `${dCount > 0 ? '，' : ''}另有 ${uCount} 台待授权`;
      msg += ` (扫描了 ${result.scanned || 0} 个IP)`;
      setLanScanProgress(msg);
    } catch (e: any) {
      setLanScanProgress('');
      setError('扫描异常: ' + e.message);
    } finally {
      setLanScanning(false);
    }
  }, [lanScanning]);

  // Connect to a network device by IP
  const connectToNetworkDevice = useCallback(async (ip: string, port: number = 5555) => {
    setConnecting(true);
    setConnectingId(`${ip}:${port}`);
    setError('');

    try {
      // Try to connect
      await execAdb(['connect', `${ip}:${port}`]);

      // Verify connection
      await new Promise(r => setTimeout(r, 1000));
      const output = await execAdb(['devices', '-l']);

      const deviceId = `${ip}:${port}`;
      if (!output.includes(deviceId)) {
        throw new Error('连接失败，请确认设备已开启无线ADB');
      }

      // Get device properties
      const props = await getDeviceProperties(deviceId);

      const device: AndroidDevice = {
        id: deviceId,
        type: 'network',
        ip,
        port,
        status: 'connected',
        ...props,
      };

      // Remove from discovered list if it was there
      setLanDiscoveredDevices(prev => prev.filter(d => d.id !== deviceId));

      // Create new tab
      const newTab: ConnectionTab = {
        id: `android_${Date.now()}`,
        deviceId: device.id,
        device,
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTab(newTab);
      await refreshPageInfo(newTab);

      // Refresh device list
      await scanDevices();
    } catch (e: any) {
      setError('连接失败: ' + e.message);
    } finally {
      setConnecting(false);
      setConnectingId(null);
    }
  }, [execAdb, getDeviceProperties, scanDevices]);

  // Handle manual IP connect
  // P1-12 fix: use ref to avoid stale manualIp closure
  const handleManualConnect = useCallback(async () => {
    const input = manualIpRef.current.trim();
    if (!input) return;

    let ip = input;
    let port = 5555;

    if (input.includes(':')) {
      const [parsedIp, parsedPort] = input.split(':');
      ip = parsedIp;
      port = parseInt(parsedPort, 10) || 5555;
    }

    await connectToNetworkDevice(ip, port);
    setManualIp('');
  }, [connectToNetworkDevice]);

  // Initial load
  useEffect(() => {
    (async () => {
      try { await fetchLocalIps(); } catch (e) { /* ignore */ }
      try { await scanDevices(); } catch (e) { /* ignore */ }
    })();
  }, []);

  // Refresh page info (screenshot)
  const refreshPageInfo = useCallback(async (tab: ConnectionTab) => {
    if (!tab) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.execAdbScreenshot(tab.deviceId);
      let screenshot = '';
      if (result.ok) {
        screenshot = result.screenshot;
      }

      setTabs(prev => prev.map(t =>
        t.id === tab.id ? { ...t, screenshot } : t
      ));

      if (activeTab?.id === tab.id) {
        setActiveTab(prev => prev ? { ...prev, screenshot } : null);
      }
    } catch (e: any) {
      console.error('Page info error:', e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  // Connect to device
  const connectToDevice = useCallback(async (device: AndroidDevice) => {
    setConnecting(true);
    setConnectingId(device.id);
    setError('');

    try {
      if (device.type === 'network') {
        await execAdb(['connect', device.id]);
        await new Promise(r => setTimeout(r, 1000));
      }

      const output = await execAdb(['devices']);
      const checkId = device.ip || device.id.split(':')[0];
      if (!output.includes(checkId) && !output.includes(device.id)) {
        throw new Error('设备未找到，请确认已连接');
      }

      // Get properties if not available
      let props = {};
      if (!device.model) {
        props = await getDeviceProperties(device.id);
      }

      const newTab: ConnectionTab = {
        id: `android_${Date.now()}`,
        deviceId: device.id,
        device: { ...device, ...props, status: 'connected' as const },
      };

      setTabs(prev => [...prev, newTab]);
      setActiveTab(newTab);
      await refreshPageInfo(newTab);
    } catch (e: any) {
      setError('连接失败: ' + e.message);
    } finally {
      setConnecting(false);
      setConnectingId(null);
    }
  }, [execAdb, getDeviceProperties, refreshPageInfo]);

  // Tap on coordinates
  const handleTap = useCallback(async (x: number, y: number) => {
    const tab = activeTabRef.current;
    if (!tab) return;
    const deviceId = tab.deviceId;
    try {
      await execAdb(['-s', deviceId, 'shell', 'input', 'tap', String(x), String(y)]);
      setTimeout(() => refreshPageInfo(activeTabRef.current!), 500);
    } catch (e: any) {
      setError('Tap failed: ' + e.message);
    }
  }, [execAdb, refreshPageInfo]);

  // Swipe
  const handleSwipe = useCallback(async (direction: 'up' | 'down' | 'left' | 'right') => {
    const tab = activeTabRef.current;
    if (!tab || !imageRef.current) return;

    const img = imageRef.current;
    const w = img.naturalWidth || 1080;
    const h = img.naturalHeight || 2400;
    const sw = Math.round(w * 0.25);

    let startX, startY, endX, endY;
    switch (direction) {
      case 'up':
        startX = w / 2; startY = h * 0.8; endX = w / 2; endY = h * 0.2;
        break;
      case 'down':
        startX = w / 2; startY = h * 0.2; endX = w / 2; endY = h * 0.8;
        break;
      case 'left':
        startX = w * 0.8; startY = h / 2; endX = w * 0.2; endY = h / 2;
        break;
      case 'right':
        startX = w * 0.2; startY = h / 2; endX = w * 0.8; endY = h / 2;
        break;
    }

    const deviceId = tab.deviceId;
    try {
      await execAdb([
        '-s', deviceId, 'shell', 'input', 'swipe',
        String(startX), String(startY), String(endX), String(endY), String(sw)
      ]);
      setTimeout(() => refreshPageInfo(activeTabRef.current!), 500);
    } catch (e: any) {
      setError('Swipe failed: ' + e.message);
    }
  }, [execAdb, refreshPageInfo]);

  // Handle image click for tap
  const handleImageClick = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (!activeTab || !imageRef.current) return;

    const img = imageRef.current;
    const rect = img.getBoundingClientRect();
    const scaleX = (img.naturalWidth || 1080) / rect.width;
    const scaleY = (img.naturalHeight || 2400) / rect.height;

    const x = Math.round((e.clientX - rect.left) * scaleX);
    const y = Math.round((e.clientY - rect.top) * scaleY);

    handleTap(x, y);
  }, [activeTab, handleTap]);

  // Disconnect device
  const disconnectDevice = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTab?.id === tabId) {
        setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
      }
      return newTabs;
    });
  }, [activeTab]);

  // Auto-refresh screenshot
  // P1-10 fix: use ref to always get current activeTab
  useEffect(() => {
    if (!activeTab || refreshInterval <= 0) return;

    scanTimerRef.current = setInterval(() => {
      if (!loading) {
        const tab = activeTabRef.current;
        if (tab) refreshPageInfo(tab);
      }
    }, refreshInterval);

    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [activeTab, refreshInterval, loading, refreshPageInfo]);

  // ── Render Helpers ────────────────────────────────────────────────────────

  const whiteTxt = (bg: string) => textColorForBg(bg);

  const btnStyle: React.CSSProperties = {
    padding: '6px 12px',
    background: theme.bgTertiary,
    color: theme.text,
    border: `1px solid ${theme.border}`,
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 12,
  };

  // Render a device item
  const renderDeviceItem = (device: AndroidDevice, source: 'usb' | 'network' | 'discovered' = 'network') => {
    const isConnecting = connectingId === device.id;
    const isDiscovered = device.status === 'discovered';
    const isUnauthorized = device.status === 'unauthorized';

    const displayId = device.type === 'network'
      ? (device.ip && device.port ? `${device.ip}:${device.port}` : device.ip || device.id)
      : (device.serial || device.id);

    return (
      <div
        key={device.id}
        style={{
          padding: '8px 12px',
          background: theme.surface,
          borderRadius: 4,
          marginBottom: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: isUnauthorized ? `1px solid ${theme.error}` : isDiscovered ? `1px solid ${theme.success}` : `1px solid ${theme.border}`,
          opacity: device.status === 'disconnected' ? 0.5 : 1,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14 }}>
              {source === 'usb' ? <Cable size={14} style={{ verticalAlign: 'middle' }} /> : isDiscovered ? <Plus size={14} style={{ verticalAlign: 'middle' }} /> : isUnauthorized ? <AlertTriangle size={14} style={{ verticalAlign: 'middle' }} /> : <Wifi size={14} style={{ verticalAlign: 'middle' }} />}
            </span>
            <span style={{ fontWeight: 500, color: theme.text, fontSize: 13 }}>
              {device.model || (device.type === 'network' ? 'Android 设备' : 'Unknown')}
            </span>
            {device.version && (
              <span style={{ fontSize: 10, color: theme.textSecondary, background: theme.bgTertiary, padding: '1px 5px', borderRadius: 3 }}>
                {device.version}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2, paddingLeft: 24 }}>
            <span>{displayId}</span>
            {device.manufacturer && (
              <span style={{ marginLeft: 8 }}>{device.manufacturer}</span>
            )}
          </div>
          {isUnauthorized && (
            <div style={{ fontSize: 11, color: theme.error, marginTop: 2, paddingLeft: 24 }}>
              <AlertTriangle size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />请在设备上授权此电脑
            </div>
          )}
          {isDiscovered && (
            <div style={{ fontSize: 11, color: theme.success, marginTop: 2, paddingLeft: 24 }}>
              <span style={{ color: theme.success }}>✓</span> 点击连接
            </div>
          )}
        </div>
        <button
          onClick={() => connectToNetworkDevice(device.ip!, device.port || 5555)}
          disabled={connecting || isUnauthorized}
          style={{
            padding: '4px 12px',
            background: isUnauthorized ? theme.textTertiary : theme.primary,
            color: whiteTxt(isUnauthorized ? theme.textTertiary : theme.primary),
            border: 'none',
            borderRadius: 4,
            cursor: (connecting || isUnauthorized) ? 'not-allowed' : 'pointer',
            fontSize: 12,
            marginLeft: 8,
          }}
        >
          {isConnecting ? '...' : '连接'}
        </button>
      </div>
    );
  };

  const discoveredCount = lanDiscoveredDevices.filter(d => d.status === 'discovered').length;
  const unauthorizedCount = lanDiscoveredDevices.filter(d => d.status === 'unauthorized').length;

  return (
    <div style={{ display: 'flex', height: '100%', background: theme.bg, color: theme.text }}>
      {/* ── Left Sidebar ── */}
      <div style={{ width: 300, borderRight: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', background: theme.bgSecondary }}>

        {/* Header */}
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10, color: theme.text, display: 'flex', alignItems: 'center', gap: 6 }}><Smartphone size={14} style={{ verticalAlign: 'middle' }} /> Android Devices</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={scanDevices}
              disabled={scanning}
              style={{
                flex: 1, padding: '5px 8px', background: theme.primary, color: whiteTxt(theme.primary),
                border: 'none', borderRadius: 4, cursor: scanning ? 'not-allowed' : 'pointer', fontSize: 12,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} style={{ verticalAlign: 'middle' }} /> {scanning ? '...' : '刷新'}
              </span>
            </button>
            <button
              onClick={handleLanDiscovery}
              disabled={lanScanning}
              style={{
                flex: 1, padding: '5px 8px',
                background: lanScanning ? theme.textTertiary : theme.success,
                color: whiteTxt(lanScanning ? theme.textTertiary : theme.success), border: 'none', borderRadius: 4,
                cursor: lanScanning ? 'not-allowed' : 'pointer', fontSize: 12,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Search size={13} style={{ verticalAlign: 'middle' }} /> {lanScanning ? '扫描中...' : '局域网发现'}
              </span>
            </button>
          </div>
        </div>

        {/* Local IP info */}
        {localIps.length > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: `1px solid ${theme.border}`, background: theme.bgTertiary }}>
            <div style={{ fontSize: 11, color: theme.textTertiary, marginBottom: 4 }}>本机 IP</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {localIps.map((iface, i) => (
                <span
                  key={i}
                  style={{ fontSize: 11, color: theme.primary, background: theme.bgSelected, padding: '2px 8px', borderRadius: 3 }}
                  title={`${iface.name} (${iface.netmask})`}
                >
                  {iface.ip}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* LAN Scan progress */}
        {lanScanProgress && (
          <div style={{
            padding: '6px 16px', borderBottom: `1px solid ${theme.border}`,
            background: theme.bgTertiary,
            fontSize: 11, color: theme.primary,
          }}>
            {lanScanning && <Loader size={11} style={{ verticalAlign: 'middle', marginRight: 6, animation: 'spin 1s linear infinite' }} />}
            {lanScanProgress}
          </div>
        )}

        {/* Device List */}
        <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>

          {/* Discovered LAN Devices */}
          {lanDiscoveredDevices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                <span style={{ fontSize: 12, color: theme.success, display: 'flex', alignItems: 'center', gap: 4 }}><Plus size={12} style={{ verticalAlign: 'middle' }} />发现的设备</span>
                {discoveredCount > 0 && (
                  <span style={{ fontSize: 10, background: theme.success, color: '#FFFFFF', padding: '1px 6px', borderRadius: 8 }}>
                    {discoveredCount}
                  </span>
                )}
                {unauthorizedCount > 0 && (
                  <span style={{ fontSize: 10, background: theme.warning, color: '#000', padding: '1px 6px', borderRadius: 8 }}>
                    {unauthorizedCount} 待授权
                  </span>
                )}
              </div>
              {lanDiscoveredDevices.map(d => renderDeviceItem(d, 'discovered'))}
            </div>
          )}

          {/* USB Devices */}
          {usbDevices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Cable size={12} style={{ verticalAlign: 'middle' }} /> USB 设备 ({usbDevices.length})
              </div>
              {usbDevices.map(d => renderDeviceItem(d, 'usb'))}
            </div>
          )}

          {/* WiFi (paired) Devices */}
          {networkDevices.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, paddingLeft: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wifi size={12} style={{ verticalAlign: 'middle' }} /> WiFi 已配对 ({networkDevices.length})
              </div>
              {networkDevices.map(d => renderDeviceItem(d, 'network'))}
            </div>
          )}

          {/* Empty state */}
          {usbDevices.length === 0 && networkDevices.length === 0 && lanDiscoveredDevices.length === 0 && !scanning && !lanScanning && (
            <div style={{ textAlign: 'center', color: theme.textTertiary, padding: 20 }}>
              <Smartphone size={40} style={{ marginBottom: 12, opacity: 0.4 }} />
              <div style={{ fontSize: 13, marginBottom: 4, color: theme.textSecondary }}>未发现设备</div>
              <div style={{ fontSize: 11, color: theme.textTertiary, marginTop: 4 }}>
                1. 点击「局域网发现」扫描同局域网设备<br />
                2. 或使用 USB 连接并开启调试
              </div>
            </div>
          )}

          {/* Manual IP Connect */}
          <div style={{ marginTop: 16, borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
            <div style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, paddingLeft: 4 }}>
              <Plus size={12} /> 手动IP连接
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="text"
                value={manualIp}
                onChange={(e) => setManualIp(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualConnect()}
                placeholder="192.168.1.100:5555"
                style={{
                  flex: 1, padding: '6px 8px', background: theme.surface,
                  border: `1px solid ${theme.borderHover}`, borderRadius: 4, color: theme.text, fontSize: 12,
                }}
              />
              <button
                onClick={handleManualConnect}
                disabled={connecting || !manualIp.trim()}
                style={{
                  padding: '6px 12px',
                  background: connecting ? theme.textTertiary : theme.success,
                  color: whiteTxt(connecting ? theme.textTertiary : theme.success), border: 'none', borderRadius: 4,
                  cursor: connecting || !manualIp.trim() ? 'not-allowed' : 'pointer', fontSize: 12,
                }}
              >
                连接
              </button>
            </div>
            <div style={{ fontSize: 10, color: theme.textTertiary, marginTop: 4, paddingLeft: 4 }}>
              输入IP:端口，默认 :5555
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{ padding: '8px 12px', background: theme.bgTertiary, borderTop: `1px solid ${theme.error}`, fontSize: 11, color: theme.error }}>
            <AlertTriangle size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{error}
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {activeTab ? (
          <>
            {/* Tab Bar */}
            <div style={{
              padding: '8px 12px', background: theme.bgSecondary, borderBottom: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {tabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => setActiveTab(tab)}
                  style={{
                    padding: '4px 12px',
                    background: activeTab.id === tab.id ? theme.primary : theme.bgTertiary,
                    borderRadius: 4, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 12,
                    color: theme.text,
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center' }}>{tab.device.type === 'usb' ? <Cable size={13} style={{ verticalAlign: 'middle' }} /> : <Wifi size={13} style={{ verticalAlign: 'middle' }} />}</span>
                  <span>{tab.device.model || tab.device.ip || 'Android'}</span>
                  <span
                    onClick={(e) => { e.stopPropagation(); disconnectDevice(tab.id); }}
                    style={{ marginLeft: 4, cursor: 'pointer', opacity: 0.7, display: 'flex', alignItems: 'center' }}
                  >
                    <X size={13} style={{ verticalAlign: 'middle' }} />
                  </span>
                </div>
              ))}
            </div>

            {/* Controls */}
            <div style={{
              padding: '8px 12px', background: theme.bgSecondary, borderBottom: `1px solid ${theme.border}`,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <button
                onClick={() => refreshPageInfo(activeTab)}
                disabled={loading}
                style={{
                  padding: '6px 12px', background: theme.primary, color: whiteTxt(theme.primary),
                  border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? '...' : <><RefreshCw size={13} style={{ verticalAlign: 'middle' }} /> Refresh</>}
              </button>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                style={{ padding: 6, background: theme.bgTertiary, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 4 }}
              >
                <option value={0}>不自动刷新</option>
                <option value={1000}>1s</option>
                <option value={3000}>3s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
              </select>
              <span style={{ color: theme.textTertiary, fontSize: 12, marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
                {activeTab.device.type === 'usb' ? <Cable size={13} style={{ verticalAlign: 'middle' }} /> : <Wifi size={13} style={{ verticalAlign: 'middle' }} />} {activeTab.deviceId}
              </span>
            </div>

            {/* Screenshot - device viewer stays dark */}
            <div
              ref={containerRef}
              style={{
                flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center',
                justifyContent: 'center', padding: 16, background: '#000000',
              }}
            >
              {activeTab.screenshot ? (
                <img
                  ref={imageRef}
                  src={`data:image/png;base64,${activeTab.screenshot}`}
                  onClick={handleImageClick}
                  style={{
                    maxWidth: '100%', maxHeight: '100%', objectFit: 'contain',
                    cursor: 'crosshair', border: `1px solid ${theme.border}`,
                  }}
                  alt="Device screenshot"
                />
              ) : (
                <div style={{ color: theme.textTertiary }}>
                  {loading ? '正在截屏...' : '无截图'}
                </div>
              )}
            </div>

            {/* Navigation D-pad + quick actions */}
            <div style={{
              padding: '8px 12px', background: theme.bgSecondary, borderTop: `1px solid ${theme.border}`,
              display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center',
            }}>
              {/* D-pad: up / left / confirm / right / down */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 44px)', gridTemplateRows: 'repeat(3, 44px)', gap: 2 }}>
                {/* row 1 */}
                <div />
                <button
                  type="button"
                  onClick={async () => {
                    try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '19']); refreshPageInfo(activeTab); } catch {}
                  }}
                  style={{ ...btnStyle, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.primary, color: whiteTxt(theme.primary) }}
                  title="上"
                ><ArrowUp size={16} /></button>
                <div />
                {/* row 2 */}
                <button
                  type="button"
                  onClick={async () => {
                    try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '21']); refreshPageInfo(activeTab); } catch {}
                  }}
                  style={{ ...btnStyle, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.primary, color: whiteTxt(theme.primary) }}
                  title="左"
                ><ArrowLeft size={16} /></button>
                <button
                  type="button"
                  onClick={async () => {
                    try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '23']); refreshPageInfo(activeTab); } catch {}
                  }}
                  style={{ ...btnStyle, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.success, color: whiteTxt(theme.success) }}
                  title="确认 (DPAD_CENTER)"
                ><CornerDownLeft size={16} /></button>
                <button
                  type="button"
                  onClick={async () => {
                    try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '22']); refreshPageInfo(activeTab); } catch {}
                  }}
                  style={{ ...btnStyle, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.primary, color: whiteTxt(theme.primary) }}
                  title="右"
                ><ArrowRight size={16} /></button>
                {/* row 3 */}
                <div />
                <button
                  type="button"
                  onClick={async () => {
                    try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '20']); refreshPageInfo(activeTab); } catch {}
                  }}
                  style={{ ...btnStyle, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: theme.primary, color: whiteTxt(theme.primary) }}
                  title="下"
                ><ArrowDown size={16} /></button>
                <div />
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 60, background: theme.border }} />

              {/* Swipe buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: theme.textTertiary, textAlign: 'center', marginBottom: 2 }}>滑动</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button type="button" onClick={() => handleSwipe('up')} style={btnStyle} title="上滑"><ArrowUp size={14} /></button>
                  <button type="button" onClick={() => handleSwipe('down')} style={btnStyle} title="下滑"><ArrowDown size={14} /></button>
                  <button type="button" onClick={() => handleSwipe('left')} style={btnStyle} title="左滑"><ArrowLeft size={14} /></button>
                  <button type="button" onClick={() => handleSwipe('right')} style={btnStyle} title="右滑"><ArrowRight size={14} /></button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, height: 60, background: theme.border }} />

              {/* Quick action buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 10, color: theme.textTertiary, textAlign: 'center', marginBottom: 2 }}>快捷</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    type="button"
                    onClick={async () => {
                      try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '4']); refreshPageInfo(activeTab); } catch {}
                    }}
                    style={btnStyle} title="返回"
                  ><ArrowLeft size={14} /></button>
                  <button
                    type="button"
                    onClick={async () => {
                      try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '3']); refreshPageInfo(activeTab); } catch {}
                    }}
                    style={btnStyle} title="主页"
                  ><Home size={14} /></button>
                  <button
                    type="button"
                    onClick={async () => {
                      try { await execAdb(['-s', activeTab.deviceId, 'shell', 'input', 'keyevent', '187']); refreshPageInfo(activeTab); } catch {}
                    }}
                    style={btnStyle} title="最近任务"
                  ><LayoutGrid size={14} /></button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: theme.textTertiary }}>
            <Smartphone size={56} style={{ marginBottom: 16, opacity: 0.3 }} />
            <div style={{ fontSize: 16, marginBottom: 8, color: theme.textSecondary }}>连接一个 Android 设备</div>
            <div style={{ fontSize: 12, color: theme.textTertiary }}>
              从左侧列表选择设备或点击「局域网发现」
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AndroidPage;

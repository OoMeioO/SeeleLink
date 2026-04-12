/**
 * DesignThemeGallery - UI for browsing and selecting design themes
 *
 * Features:
 * - Grid of built-in themes
 * - Upload custom DESIGN.md
 * - Import from URL
 * - Preview and apply themes
 */
import React, { useState, useRef } from 'react';
import {
  X, Upload, Link, Check, Palette, Moon, Sun,
  ChevronLeft, ChevronRight, Sparkles
} from 'lucide-react';
import type { DesignTheme } from './types';
import { builtinDesignThemes } from './design-themes';
import { parseUploadedDesignMd, fetchDesignMd } from './DesignThemeParser';

interface DesignThemeGalleryProps {
  currentTheme: DesignTheme | null;
  onSelect: (theme: DesignTheme | null) => void;
  onClose: () => void;
}

export function DesignThemeGallery({
  currentTheme,
  onSelect,
  onClose,
}: DesignThemeGalleryProps) {
  const [activeTab, setActiveTab] = useState<'builtin' | 'upload' | 'import'>('builtin');
  const [uploadedThemes, setUploadedThemes] = useState<DesignTheme[]>([]);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<DesignTheme | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter built-in themes by dark/light
  const builtinDark = builtinDesignThemes.filter(t =>
    t.id.includes('light') === false && t.source === 'builtin'
  );
  const builtinLight = builtinDesignThemes.filter(t =>
    t.id.includes('light') === true && t.source === 'builtin'
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const theme = await parseUploadedDesignMd(file);
    if (theme) {
      setUploadedThemes(prev => [...prev, theme]);
      onSelect(theme);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportUrl = async () => {
    if (!importUrl.trim()) return;

    setImporting(true);
    setImportError(null);

    try {
      const theme = await fetchDesignMd(importUrl.trim());
      if (theme) {
        setUploadedThemes(prev => [...prev, theme]);
        onSelect(theme);
        setImportUrl('');
      } else {
        setImportError('Failed to parse DESIGN.md from URL');
      }
    } catch (error) {
      setImportError('Failed to fetch or parse DESIGN.md');
    } finally {
      setImporting(false);
    }
  };

  const handleReset = () => {
    onSelect(null);
  };

  const isActive = (theme: DesignTheme | null) => {
    if (!currentTheme && !theme) return true;
    if (!currentTheme || !theme) return false;
    return currentTheme.id === theme.id;
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }} onClick={onClose}>
      <div
        style={{
          backgroundColor: '#1C1C1E',
          border: '1px solid #3C3C3C',
          borderRadius: 12,
          width: '90vw',
          maxWidth: 900,
          height: '80vh',
          maxHeight: 600,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid #3C3C3C',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Palette size={20} style={{ color: '#4A9EFF' }} />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#E5E5E5' }}>
              Theme Gallery
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#858585',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '12px 20px',
          borderBottom: '1px solid #3C3C3C',
        }}>
          {(['builtin', 'upload', 'import'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '8px 16px',
                fontSize: 13,
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                backgroundColor: activeTab === tab ? '#4A9EFF' : 'transparent',
                color: activeTab === tab ? '#FFF' : '#ABABAB',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {tab === 'builtin' && <Sparkles size={14} />}
              {tab === 'upload' && <Upload size={14} />}
              {tab === 'import' && <Link size={14} />}
              {tab === 'builtin' ? 'Built-in' : tab === 'upload' ? 'Upload' : 'Import URL'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          {activeTab === 'builtin' && (
            <BuiltinThemesSection
              darkThemes={builtinDark}
              lightThemes={builtinLight}
              currentTheme={currentTheme}
              onSelect={onSelect}
            />
          )}

          {activeTab === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".md,text/markdown"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="design-md-upload"
              />
              <label
                htmlFor="design-md-upload"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  padding: 32,
                  border: '2px dashed #3C3C3C',
                  borderRadius: 12,
                  cursor: 'pointer',
                  transition: 'border-color 0.2s',
                }}
              >
                <Upload size={32} style={{ color: '#4A9EFF' }} />
                <span style={{ color: '#E5E5E5', fontSize: 14 }}>
                  Click to upload DESIGN.md
                </span>
                <span style={{ color: '#6E6E6E', fontSize: 12 }}>
                  Supports Markdown files
                </span>
              </label>

              {uploadedThemes.length > 0 && (
                <div style={{ width: '100%', marginTop: 20 }}>
                  <h4 style={{ color: '#ABABAB', fontSize: 12, marginBottom: 12 }}>Uploaded Themes</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                    {uploadedThemes.map(theme => (
                      <ThemeCard
                        key={theme.id}
                        theme={theme}
                        isActive={isActive(theme)}
                        onSelect={() => onSelect(theme)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'import' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 500, margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="url"
                  value={importUrl}
                  onChange={e => setImportUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/.../DESIGN.md"
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    fontSize: 13,
                    backgroundColor: '#2D2D2F',
                    border: '1px solid #3C3C3C',
                    borderRadius: 6,
                    color: '#E5E5E5',
                    outline: 'none',
                  }}
                />
                <button
                  onClick={handleImportUrl}
                  disabled={importing || !importUrl.trim()}
                  style={{
                    padding: '10px 16px',
                    fontSize: 13,
                    backgroundColor: importing ? '#3C3C3C' : '#4A9EFF',
                    color: '#FFF',
                    border: 'none',
                    borderRadius: 6,
                    cursor: importing ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  {importing ? <ChevronRight size={14} /> : <Link size={14} />}
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
              {importError && (
                <div style={{ color: '#E53935', fontSize: 12 }}>
                  {importError}
                </div>
              )}
              <p style={{ color: '#6E6E6E', fontSize: 12, margin: 0 }}>
                Paste a raw GitHub URL to a DESIGN.md file. Example:
                <br />
                <code style={{ color: '#858585' }}>
                  https://raw.githubusercontent.com/VoltAgent/awesome-design-md/main/design-md/claude/README.md
                </code>
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentTheme && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderTop: '1px solid #3C3C3C',
            backgroundColor: '#141417',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={16} style={{ color: '#4CAF50' }} />
              <span style={{ color: '#E5E5E5', fontSize: 13 }}>
                Active: <strong>{currentTheme.name}</strong>
              </span>
            </div>
            <button
              onClick={handleReset}
              style={{
                padding: '6px 12px',
                fontSize: 12,
                backgroundColor: 'transparent',
                color: '#ABABAB',
                border: '1px solid #3C3C3C',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reset to Default
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub Components ──────────────────────────────────────────────────────────────

interface BuiltinThemesSectionProps {
  darkThemes: DesignTheme[];
  lightThemes: DesignTheme[];
  currentTheme: DesignTheme | null;
  onSelect: (theme: DesignTheme | null) => void;
}

function BuiltinThemesSection({
  darkThemes,
  lightThemes,
  currentTheme,
  onSelect,
}: BuiltinThemesSectionProps) {
  const [darkExpanded, setDarkExpanded] = useState(true);
  const [lightExpanded, setLightExpanded] = useState(true);

  const isActive = (theme: DesignTheme) => currentTheme?.id === theme.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Dark Themes */}
      <div>
        <button
          onClick={() => setDarkExpanded(!darkExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          <Moon size={14} style={{ color: '#858585' }} />
          <span style={{ color: '#ABABAB', fontSize: 12, fontWeight: 500 }}>
            Dark Themes ({darkThemes.length})
          </span>
          <ChevronRight
            size={14}
            style={{
              color: '#6E6E6E',
              transform: darkExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {darkExpanded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {darkThemes.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={isActive(theme)}
                onSelect={() => onSelect(theme)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Light Themes */}
      <div>
        <button
          onClick={() => setLightExpanded(!lightExpanded)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            marginBottom: 12,
          }}
        >
          <Sun size={14} style={{ color: '#858585' }} />
          <span style={{ color: '#ABABAB', fontSize: 12, fontWeight: 500 }}>
            Light Themes ({lightThemes.length})
          </span>
          <ChevronRight
            size={14}
            style={{
              color: '#6E6E6E',
              transform: lightExpanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
            }}
          />
        </button>

        {lightExpanded && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {lightThemes.map(theme => (
              <ThemeCard
                key={theme.id}
                theme={theme}
                isActive={isActive(theme)}
                onSelect={() => onSelect(theme)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Theme Card ─────────────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: DesignTheme;
  isActive: boolean;
  onSelect: () => void;
}

function ThemeCard({ theme, isActive, onSelect }: ThemeCardProps) {
  const colors = theme.tokens.colors;

  return (
    <button
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 12,
        backgroundColor: colors.bg || '#1C1C1E',
        border: isActive ? `2px solid ${colors.primary || '#4A9EFF'}` : '2px solid transparent',
        borderRadius: 8,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {/* Preview swatches */}
      <div style={{ display: 'flex', gap: 4 }}>
        {theme.swatches.map((color, i) => (
          <div
            key={i}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: color,
              border: '1px solid rgba(128,128,128,0.2)',
            }}
          />
        ))}
      </div>

      {/* Theme name */}
      <div>
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: colors.text || '#E5E5E5',
          marginBottom: 2,
        }}>
          {theme.name}
        </div>
        <div style={{
          fontSize: 10,
          color: colors.textSecondary || '#ABABAB',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {theme.description}
        </div>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div style={{
          position: 'absolute',
          top: 8,
          right: 8,
          width: 16,
          height: 16,
          borderRadius: '50%',
          backgroundColor: colors.primary || '#4A9EFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Check size={10} color="#FFF" />
        </div>
      )}
    </button>
  );
}

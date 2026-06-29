import { useState, useEffect, useRef } from 'react';
import { UploadCloud, Copy, Image as ImageIcon, Trash2, LogIn, Loader2, Check, RefreshCw } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import './index.css';

const API_BASE = import.meta.env.DEV ? 'http://127.0.0.1:8787' : 'https://api.cheatppf.xyz';

type Toast = { msg: string; type: string };
type ImageItem = { key: string; url: string; size: number; uploaded: string };

function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [isLogged, setIsLogged] = useState(!!token);
  const [images, setImages] = useState<ImageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string, type = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    localStorage.setItem('token', token);
    setIsLogged(true);
    fetchImages();
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setIsLogged(false);
    setImages([]);
  };

  const fetchImages = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/images`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.status === 401) {
        handleLogout();
        showToast('Token expired or invalid', 'error');
        return;
      }
      const data = await res.json();
      if (data.images) setImages(data.images);
    } catch (err) {
      showToast('Failed to fetch images', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLogged) fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLogged]);

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please upload an image file', 'error');
      return;
    }
    
    setUploading(true);
    
    let fileToUpload = file;
    // 自动压缩大于 500KB 的图片 (非 GIF)
    if (file.size > 500 * 1024 && !file.type.includes('gif')) {
      showToast('正在压缩图片...', 'info');
      try {
        const options = {
          maxSizeMB: 1, // 压缩到最大 1MB
          maxWidthOrHeight: 1920, // 限制最大宽度/高度
          useWebWorker: true,
          fileType: file.type // 保持原有格式
        };
        fileToUpload = await imageCompression(file, options);
      } catch (error) {
        console.error('图片压缩失败:', error);
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload, file.name);

    try {
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      
      if (res.status === 401) {
        handleLogout();
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        showToast('Image uploaded successfully!', 'success');
        fetchImages();
      } else {
        showToast(data.error || 'Upload failed', 'error');
      }
    } catch (err) {
      showToast('Network error during upload', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (key: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/images/${key}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        showToast('Image deleted', 'success');
        fetchImages();
      }
    } catch (err) {
      showToast('Failed to delete image', 'error');
    }
  };

  const copyToClipboard = (text: string, isMarkdown = false) => {
    const content = isMarkdown ? `![image](${text})` : text;
    navigator.clipboard.writeText(content);
    showToast('Copied to clipboard!', 'success');
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const onDragLeave = () => setDragActive(false);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  };

  if (!isLogged) {
    return (
      <div className="app-container">
        <div className="header">
          <h1>Image Cook</h1>
          <p>Personal Cloudflare R2 Image Hosting</p>
        </div>
        <div className="glass-panel login-container">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <ImageIcon size={48} color="var(--accent)" />
          </div>
          <h2 style={{ marginBottom: '1.5rem' }}>Admin Login</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Secret Token</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Enter your admin token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <LogIn size={20} /> Login
            </button>
          </form>
        </div>
        {toast && (
          <div className="toast-container">
            <div className="toast">
              {toast.msg}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'left' }}>
          <h1>Image Cook</h1>
          <p>Manage your R2 bucket images</p>
        </div>
        <button onClick={handleLogout} className="btn" style={{ background: 'rgba(255,255,255,0.1)' }}>
          Logout
        </button>
      </div>

      <div 
        className={`upload-zone ${dragActive ? 'drag-active' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
        />
        {uploading ? (
          <Loader2 size={48} className="loader upload-icon" style={{ margin: '0 auto 1rem' }} />
        ) : (
          <UploadCloud size={48} className="upload-icon" style={{ margin: '0 auto 1rem' }} />
        )}
        <div className="upload-text">Click or drag image here to upload</div>
        <div className="upload-subtext">Supports PNG, JPG, GIF, WebP</div>
      </div>

      <div className="glass-panel">
        <div className="gallery-header">
          <h2>Gallery ({images.length})</h2>
          <button onClick={fetchImages} className="btn" style={{ background: 'transparent', padding: '0.5rem' }}>
            <RefreshCw size={20} className={loading ? 'loader' : ''} />
          </button>
        </div>

        {loading && images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            <Loader2 size={32} className="loader" style={{ margin: '0 auto 1rem' }} />
            Loading images...
          </div>
        ) : images.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No images found in your bucket.
          </div>
        ) : (
          <div className="gallery-grid">
            {images.map((img) => (
              <div key={img.key} className="image-card">
                <img src={img.url} alt={img.key} loading="lazy" />
                <div className="image-overlay">
                  <div className="image-actions">
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(img.url); }} title="Copy URL">
                      <Copy size={16} /> URL
                    </button>
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); copyToClipboard(img.url, true); }} title="Copy Markdown">
                      <Copy size={16} /> MD
                    </button>
                    <button className="action-btn delete" onClick={(e) => { e.stopPropagation(); handleDelete(img.key); }} title="Delete">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="image-info">{img.key}</div>
                  <div className="image-info">{(img.size / 1024).toFixed(1)} KB</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {toast && (
        <div className="toast-container">
          <div className="toast" style={{ borderColor: toast.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
            {toast.type === 'error' ? <Trash2 size={16} color="var(--danger)" /> : <Check size={16} color="var(--success)" />}
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

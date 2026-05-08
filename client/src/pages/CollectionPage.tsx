import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Delete } from 'lucide-react';
import { getStamps, clearStamps, type StampRecord } from '../store';

export const CollectionPage = () => {
  const navigate = useNavigate();
  const stamps = getStamps();

  const handleClear = () => {
    if (confirm('确定要清空全部图鉴吗？此操作不可恢复。')) {
      clearStamps();
      // 重新渲染页面
      window.location.reload();
    }
  };

  return (
    <div className="page" style={{ padding: '20px', position: 'relative' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '24px', textAlign: 'center' }}
      >
        <h2 className="font-mystic text-gradient-mystic" style={{ fontSize: '1.6rem' }}>
          城市命定图鉴
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          你的每一次冒险都留下了一枚像素印章，点亮城市的星光。
        </p>
      </motion.div>

      {stamps.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '60px' }}>
          <Camera size={48} style={{ opacity: 0.4 }} />
          <p style={{ marginTop: '12px' }}>暂无印章，快去探索吧 🚀</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>返回占卜</button>
        </div>
      ) : (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '16px' }}>
          {stamps.map((stamp: StampRecord) => (
            <motion.div
              key={stamp.id}
              className="glass"
              whileHover={{ scale: 1.04, boxShadow: '0 0 20px var(--primary-glow)' }}
              style={{
                padding: '12px',
                borderRadius: '12px',
                textAlign: 'center',
                background: 'var(--glass-bg)',
              }}
            >
              <img src={stamp.pixelImageData} alt={stamp.poiName} className="stamp-display" style={{ width: '100%', height: 'auto', marginBottom: '8px' }} />
              <h4 className="font-mystic" style={{ margin: '4px 0', fontSize: '0.9rem', color: '#fff' }}>{stamp.poiName}</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '6px' }}>{stamp.cardName}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* 清空按钮 */}
      {stamps.length > 0 && (
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="btn btn-ghost btn-sm"
          style={{ position: 'absolute', top: '20px', right: '20px' }}
          onClick={handleClear}
        >
          <Delete size={14} /> 清空图鉴
        </motion.button>
      )}
    </div>
  );
};

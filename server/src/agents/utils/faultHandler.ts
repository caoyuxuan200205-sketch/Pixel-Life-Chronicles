export function resolveTimelineConflicts(timeline: any[]): { timeline: any[]; resolved: boolean } {
  if (!Array.isArray(timeline)) return { timeline, resolved: false };
  
  // Matches "14:00 - 16:00", "14:00-16:00", "14:00~16:00", "14点00分-16点00分" etc.
  const parseTimeRange = (timeStr: string) => {
    const match = timeStr.match(/(\d{1,2})[：:](\d{2})\s*[-~至—]\s*(\d{1,2})[：:](\d{2})/);
    if (!match) return null;
    const startHour = parseInt(match[1]);
    const startMin = parseInt(match[2]);
    const endHour = parseInt(match[3]);
    const endMin = parseInt(match[4]);
    return {
      start: startHour * 60 + startMin,
      end: endHour * 60 + endMin
    };
  };

  const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60) % 24;
    const m = minutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  let lastEnd = -1;
  let resolved = false;

  for (let i = 0; i < timeline.length; i++) {
    const node = timeline[i];
    if (!node || typeof node.time !== 'string') continue;

    const range = parseTimeRange(node.time);
    if (!range) continue;

    // Check overlap/conflict
    if (lastEnd !== -1 && range.start < lastEnd) {
      resolved = true;
      const duration = range.end - range.start;
      const newStart = lastEnd;
      const newEnd = newStart + duration;

      const oldTimeStr = node.time;
      node.time = `${formatTime(newStart)} - ${formatTime(newEnd)}`;
      node.mysticReasoning = `⚠️ [时空冲突已自动调解] 行程时间因重叠已从 ${oldTimeStr} 顺延调整。` + (node.mysticReasoning || '');
      
      lastEnd = newEnd;
    } else {
      lastEnd = range.end;
    }

    // Check seat availability/no seat exception
    if (node.restaurantStatus) {
      const queueStatus = node.restaurantStatus.queueStatus || "";
      const isFull = /无座|满|火爆|排队/.test(queueStatus);
      if (isFull) {
        node.restaurantStatus.seatAvailability = `⚠️ 当前无空座（排队较长）。已自动提供备选：建议错峰就餐，或一键预约美团送餐/闪送到店。`;
        resolved = true;
      }
    }
  }

  return { timeline, resolved };
}

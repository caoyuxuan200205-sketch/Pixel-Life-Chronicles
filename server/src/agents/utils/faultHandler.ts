import { getCoordinates, estimateTravel } from "./geoUtils.js";

export function resolveTimelineConflicts(timeline: any[]): { timeline: any[]; resolved: boolean } {
  if (!Array.isArray(timeline)) return { timeline, resolved: false };
  
  // 1. Filter out old transit nodes to prevent duplicates
  const cleanTimeline = timeline.filter(node => 
    node && 
    node.tag !== "时空连线" && 
    !String(node.place).includes("时空流转")
  );

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

  const newTimeline: any[] = [];
  let lastEnd = -1;
  let lastPlace = "";
  let resolved = false;

  for (let i = 0; i < cleanTimeline.length; i++) {
    const node = { ...cleanTimeline[i] };
    if (!node || typeof node.time !== 'string') {
      newTimeline.push(node);
      continue;
    }

    const range = parseTimeRange(node.time);
    if (!range) {
      newTimeline.push(node);
      continue;
    }

    let start = range.start;
    let end = range.end;

    // Check if we need to insert transit node and handle conflicts
    if (i > 0 && lastEnd !== -1 && lastPlace) {
      const coord1 = getCoordinates(lastPlace);
      const coord2 = getCoordinates(node.place);
      const travel = estimateTravel(coord1, coord2);
      const T = travel.durationMinutes;
      const distKm = (travel.distanceMeters / 1000).toFixed(1);

      const earliestStart = lastEnd + T;
      let transitStart = lastEnd;
      let transitEnd = earliestStart;

      if (start < earliestStart) {
        // Conflict! Shift current stop forward
        resolved = true;
        const duration = end - start;
        start = earliestStart;
        end = start + duration;
        
        node.time = `${formatTime(start)} - ${formatTime(end)}`;
        node.mysticReasoning = `⚠️ [时空自愈] 行程由于地理开运跨度 (${distKm}km) 产生时间交叉，已自动顺延。` + (node.mysticReasoning || '');
      } else {
        // No conflict. Place transit right before the current stop starts
        transitStart = start - T;
        transitEnd = start;
      }

      // Insert Transit Node
      newTimeline.push({
        time: `${formatTime(transitStart)} - ${formatTime(transitEnd)}`,
        place: "🚲 时空流转：前往下一站点",
        tag: "时空连线",
        mysticReasoning: `全家在此凝聚星轨，以【${travel.modeZh}】方式跨越 ${distKm} 公里前往下一站，预计耗时 ${T} 分钟。`,
        restaurantStatus: null
      });
    }

    // Peak-hour restaurant availability check
    if (node.restaurantStatus) {
      const queueStatus = node.restaurantStatus.queueStatus || "";
      const isFull = /无座|满|火爆|排队/.test(queueStatus);
      if (isFull) {
        node.restaurantStatus.seatAvailability = `⚠️ 当前无空座（排队较长）。已自动提供备选：建议错峰就餐，或一键预约美团送餐/闪送到店。`;
        resolved = true;
      }
    }

    newTimeline.push(node);
    lastEnd = end;
    lastPlace = node.place;
  }

  return { timeline: newTimeline, resolved };
}

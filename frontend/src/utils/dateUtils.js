/**
 * Formats a date/timestamp to Indian Standard Time (IST - Asia/Kolkata)
 */
export const formatISTTime = (timestamp) => {
  if (!timestamp) {
    return new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
  try {
    let d;
    if (typeof timestamp === 'string') {
      const hasTz = timestamp.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamp);
      d = new Date(hasTz ? timestamp : `${timestamp}Z`);
      if (isNaN(d.getTime())) d = new Date(timestamp);
    } else {
      d = new Date(timestamp);
    }

    if (isNaN(d.getTime())) {
      return new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    }

    return d.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }
};

export const formatFullISTDateTime = (timestamp) => {
  if (!timestamp) return '';
  try {
    let d;
    if (typeof timestamp === 'string') {
      const hasTz = timestamp.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamp);
      d = new Date(hasTz ? timestamp : `${timestamp}Z`);
      if (isNaN(d.getTime())) d = new Date(timestamp);
    } else {
      d = new Date(timestamp);
    }

    if (isNaN(d.getTime())) return '';

    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  } catch {
    return '';
  }
};

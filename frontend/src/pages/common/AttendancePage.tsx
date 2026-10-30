import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

export function AttendancePage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/dashboard');
  }, [setLocation]);
  return null;
}

export default AttendancePage;

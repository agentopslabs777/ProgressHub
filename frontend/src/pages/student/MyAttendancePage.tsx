import React, { useEffect } from 'react';
import { useLocation } from 'wouter';

export function MyAttendancePage() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation('/dashboard');
  }, [setLocation]);
  return null;
}

export default MyAttendancePage;

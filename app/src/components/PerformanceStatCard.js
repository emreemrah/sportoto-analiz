import React from 'react';
import { StatCard } from '../ui';

// Dashboard metrik kutucuğu — mevcut ui.js StatCard'ının ince sarmalayıcısı.
// Ayrı bir bileşen olarak tutulması, dashboard ekranlarının import'unu
// (spec'teki component listesiyle) net tutar.
export default function PerformanceStatCard({ label, value, hint, tone, icon }) {
  return <StatCard label={label} value={value} hint={hint} tone={tone} icon={icon} />;
}

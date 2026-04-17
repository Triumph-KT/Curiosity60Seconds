"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type GrowthPoint = {
  date: string;
  value: number;
};

export type WeeklyUserPostsPoint = {
  week: string;
  [userLabel: string]: string | number;
};

export type WeeklyEngagementPoint = {
  week: string;
  reactions: number;
  comments: number;
  reposts: number;
};

export function AnalyticsCharts({
  userGrowth,
  postActivity,
  postsPerUserWeekly,
  topUserSeriesKeys,
  weeklyEngagement,
  messageVolume,
}: {
  userGrowth: GrowthPoint[];
  postActivity: GrowthPoint[];
  postsPerUserWeekly: WeeklyUserPostsPoint[];
  topUserSeriesKeys: string[];
  weeklyEngagement: WeeklyEngagementPoint[];
  messageVolume: GrowthPoint[];
}) {
  const seriesColors = ["#1b4332", "#2d6a4f", "#40916c", "#52b788", "#74c69d"];

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-2">
      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">User growth (30 days)</h2>
        <p className="mt-1 text-sm text-muted">Cumulative signups by day.</p>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={userGrowth} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#1b4332" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Post activity (30 days)</h2>
        <p className="mt-1 text-sm text-muted">Published posts per day.</p>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={postActivity} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="value" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      </div>

      <section className="card p-5 md:p-6">
        <h2 className="text-lg font-semibold text-foreground">Posts per user per week (8 weeks)</h2>
        <p className="mt-1 text-sm text-muted">Top 5 most active users by weekly publishing volume.</p>
        <div className="mt-4 h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={postsPerUserWeekly} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="week" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip />
              {topUserSeriesKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={seriesColors[idx % seriesColors.length]} radius={[3, 3, 0, 0]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-5 md:p-6">
          <h2 className="text-lg font-semibold text-foreground">Weekly engagement trend (8 weeks)</h2>
          <p className="mt-1 text-sm text-muted">Reactions, comments, and reposts per week.</p>
          <div className="mt-4 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyEngagement} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="week" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="reactions" stroke="#1b4332" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="comments" stroke="#d97706" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="reposts" stroke="#2563eb" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card p-5 md:p-6">
          <h2 className="text-lg font-semibold text-foreground">Message volume (30 days)</h2>
          <p className="mt-1 text-sm text-muted">Messages sent per day.</p>
          <div className="mt-4 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={messageVolume} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  );
}

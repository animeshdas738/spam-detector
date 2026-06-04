import postgres from 'postgres';

export function createDb(url: string) {
  return postgres(url, { ssl: 'require', max: 1, idle_timeout: 20, connect_timeout: 10 });
}

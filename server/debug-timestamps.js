// 分析时间戳问题
const timestamps = [
  1755101426953,
  1755101053500,
  1755095936113,
  1755042390420,
  1755042368687,
  1755042187769
];

console.log('🔍 Timestamp Analysis:');
console.log('='.repeat(80));

timestamps.forEach((ts, index) => {
  const date = new Date(ts);
  const now = Date.now();
  const diff = ts - now;
  const diffDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  console.log(`\n${index + 1}. Timestamp: ${ts}`);
  console.log(`   Date: ${date.toISOString()}`);
  console.log(`   Local: ${date.toString()}`);
  console.log(`   Diff from now: ${diff} ms (${diffDays} days)`);
  
  // 检查是否是秒级时间戳
  const asSeconds = ts * 1000;
  const dateFromSeconds = new Date(asSeconds);
  console.log(`   If seconds: ${dateFromSeconds.toISOString()}`);
  
  // 检查是否是微秒级时间戳
  const asMicroseconds = ts / 1000;
  const dateFromMicroseconds = new Date(asMicroseconds);
  console.log(`   If microseconds: ${dateFromMicroseconds.toISOString()}`);
});

console.log('\n🔍 Current time analysis:');
console.log('='.repeat(80));
const now = Date.now();
console.log(`Current timestamp: ${now}`);
console.log(`Current date: ${new Date(now).toISOString()}`);
console.log(`Current local: ${new Date(now).toString()}`);

// 检查默认过期时间
const defaultExpiry = 24 * 60 * 60 * 1000; // 24小时
console.log(`\nDefault expiry: ${defaultExpiry} ms (${defaultExpiry / (1000 * 60 * 60)} hours)`);
console.log(`Example expiry: ${now + defaultExpiry} (${new Date(now + defaultExpiry).toISOString()})`);

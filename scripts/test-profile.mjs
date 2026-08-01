// 用戶偏好畫像單元測試：prompt / 正規化 / 門檻邏輯 / 注入三條管線
// 執行：npm run test:profile

const store = {};
globalThis.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};

const { buildProfilePrompt, normalizeProfileFields, buildPrompt, buildAskPrompt, buildHoroscopePrompt } = await import('../worker/index.js');

let pass = 0;
let fail = 0;
function check(name, cond) {
  if (cond) { pass += 1; console.log(`ok   ${name}`); }
  else { fail += 1; console.error(`FAIL ${name}`); }
}

// --- 1. buildProfilePrompt：舊畫像＋新素材都有進 prompt ---
const [sys, usr] = buildProfilePrompt({
  nickname: '小紫',
  previousProfile: '你是穩健的規劃者，最近在意外貌與轉職。',
  recentCheckins: [
    { date: '2026-07-31', mood: 2, tags: ['工作卡關'], text: '專案一直改方向' },
    { date: '2026-07-30', mood: 4, tags: ['和朋友聚餐'], text: '' },
  ],
  recentAsks: [{ categoryName: '事業', question: '下半年加薪機會' }],
});
check('prompt 有 system+user 兩則', sys.role === 'system' && usr.role === 'user');
check('prompt 帶舊畫像', usr.content.includes('穩健的規劃者'));
check('prompt 帶新打卡與問事', usr.content.includes('工作卡關') && usr.content.includes('下半年加薪機會'));
check('system 規定 200 字內與 JSON', sys.content.includes('200 字內') && sys.content.includes('JSON'));
check('system 禁止負面標籤', sys.content.includes('不貼負面標籤'));

// --- 2. normalizeProfileFields ---
check('normalize 保留畫像', normalizeProfileFields({ profile: '你是…' }).profile === '你是…');
check('normalize 超長截斷 400', normalizeProfileFields({ profile: 'x'.repeat(500) }).profile.length === 400);
check('normalize 缺 profile → null', normalizeProfileFields({}) === null);
check('normalize 非物件 → null', normalizeProfileFields('nope') === null);

// --- 3. 三條管線都注入長期畫像 ---
const profileText = '你是穩健的規劃者，長期在意外貌與轉職。';
const [dSys, dUsr] = buildPrompt({ dateISO: '2026-08-01', mingStars: ['紫微'], userProfile: profileText });
check('日報 prompt 帶長期畫像', dUsr.content.includes('長期畫像') && dUsr.content.includes(profileText));
check('日報 system 指引不直接引用', dSys.content.includes('不要直接引用畫像原文'));
const [, aUsr] = buildAskPrompt({ palaces: [], categoryName: '事業', categoryPalace: '官祿', question: 'q', userProfile: profileText });
check('問事 prompt 帶長期畫像', aUsr.content.includes('長期畫像') && aUsr.content.includes(profileText));
const [, hUsr] = buildHoroscopePrompt({ scopeInfo: { yearly: { stem: '丙', branch: '午', mutagen: ['天同', '天機', '文昌', '廉貞'], soulNatalPalace: '官祿' } }, userProfile: profileText });
check('流年 prompt 帶長期畫像', hUsr.content.includes('長期畫像') && hUsr.content.includes(profileText));
const [, emptyUsr] = buildPrompt({ dateISO: '2026-08-01', mingStars: ['紫微'], userProfile: '' });
check('無畫像時日報 prompt 不含該區塊', !emptyUsr.content.includes('長期畫像'));

// --- 4. maybeUpdateUserProfile 門檻邏輯（mock localStorage + fetch） ---
const { maybeUpdateUserProfile, getUserProfile, userProfileForPrompt } = await import('../src/lib/userProfile.js');
const { saveProfile, saveSettings, clearAllData } = await import('../src/lib/storage.js');

clearAllData();
saveProfile({ nickname: '小紫', solarDate: '1994-06-15', timeIndex: 4, gender: '男', genderRaw: '男', createdAt: '2026-08-01' });
saveSettings({ aiDaily: true, personalize: true });

let fetchCalls = 0;
globalThis.fetch = async () => {
  fetchCalls += 1;
  return { ok: true, json: async () => ({ profile: '新畫像文字' }) };
};

// 4 則打卡：未達門檻，不應呼叫
store['ziwei.checkins'] = JSON.stringify([1, 2, 3, 4].map((i) => ({ date: `2026-07-2${i}`, mood: 3, tags: [], text: '' })));
await maybeUpdateUserProfile();
check('4 則打卡不觸發更新', fetchCalls === 0);

// 5 則打卡：達門檻，應呼叫並存檔
store['ziwei.checkins'] = JSON.stringify([1, 2, 3, 4, 5].map((i) => ({ date: `2026-07-2${i}`, mood: 3, tags: [], text: '' })));
await maybeUpdateUserProfile();
check('5 則打卡觸發更新', fetchCalls === 1);
check('畫像有存檔', getUserProfile() && getUserProfile().text === '新畫像文字');
check('注入函式回畫像', userProfileForPrompt() === '新畫像文字');

// 再來 1 則：未達新門檻（5+5），不再呼叫
store['ziwei.checkins'] = JSON.stringify([1, 2, 3, 4, 5, 6].map((i) => ({ date: `2026-07-2${i}`, mood: 3, tags: [], text: '' })));
await maybeUpdateUserProfile();
check('未達新門檻不重複呼叫', fetchCalls === 1);

// AI 關閉：不呼叫、不注入
saveSettings({ aiDaily: false });
store['ziwei.checkins'] = JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ date: `2026-07-${10 + i}`, mood: 3, tags: [], text: '' })));
await maybeUpdateUserProfile();
check('AI 關閉不觸發更新', fetchCalls === 1);
check('AI 關閉不注入畫像', userProfileForPrompt() === '');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

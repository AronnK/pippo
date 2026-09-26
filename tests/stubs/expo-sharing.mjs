export async function isAvailableAsync() { return true; }
export const shared = [];
export async function shareAsync(uri, options) { shared.push({ uri, options }); }

// Göreli, uzantısız ESM import'ları ".js" uzantısıyla yeniden dener.
// Yalnız node:test çalıştırmalarında yüklenir (bkz. register-hooks.mjs).
export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const relative = specifier.startsWith('./') || specifier.startsWith('../');
    const retriable = err && (err.code === 'ERR_MODULE_NOT_FOUND' || err.code === 'ERR_UNSUPPORTED_DIR_IMPORT');
    if (relative && retriable && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.js`, context);
    }
    throw err;
  }
}

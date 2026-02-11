import { SCRIPT_NAME, DB_NAME, DB_VERSION, STORE_SPRITES, STORE_BACKGROUNDS, STORE_IMAGE_PACKS, STORE_LIVE2D_MODELS, STORE_SDK_CACHE, DEFAULT_PACK_ID, DEFAULT_PACK_NAME } from '../core/constants.js';
import { getDb, setDb } from '../core/state.js';

// ============================================
// IndexedDB 初始化
// ============================================
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      setDb(request.result);
      console.log(`[${SCRIPT_NAME}] IndexedDB 初始化成功`);
      resolve(request.result);
    };
    request.onupgradeneeded = event => {
      const database = event.target.result;
      const transaction = event.target.transaction;
      const oldVersion = event.oldVersion;

      // 立绘存储
      if (!database.objectStoreNames.contains(STORE_SPRITES)) {
        const store = database.createObjectStore(STORE_SPRITES, { keyPath: 'id' });
        store.createIndex('characterId', 'characterId', { unique: false });
        store.createIndex('expression', 'expression', { unique: false });
      }
      // 背景存储
      if (!database.objectStoreNames.contains(STORE_BACKGROUNDS)) {
        const bgStore = database.createObjectStore(STORE_BACKGROUNDS, { keyPath: 'id' });
        bgStore.createIndex('sceneName', 'sceneName', { unique: true });
      }

      // 版本3: 添加图包支持
      if (oldVersion < 3) {
        if (!database.objectStoreNames.contains(STORE_IMAGE_PACKS)) {
          database.createObjectStore(STORE_IMAGE_PACKS, { keyPath: 'id' });
        }

        if (database.objectStoreNames.contains(STORE_SPRITES)) {
          const spriteStore = transaction.objectStore(STORE_SPRITES);
          if (!spriteStore.indexNames.contains('packId')) {
            spriteStore.createIndex('packId', 'packId', { unique: false });
          }
        }

        if (database.objectStoreNames.contains(STORE_BACKGROUNDS)) {
          const bgStore = transaction.objectStore(STORE_BACKGROUNDS);
          if (!bgStore.indexNames.contains('packId')) {
            bgStore.createIndex('packId', 'packId', { unique: false });
          }
        }

        const packStore = transaction.objectStore(STORE_IMAGE_PACKS);
        const defaultPack = {
          id: DEFAULT_PACK_ID,
          name: DEFAULT_PACK_NAME,
          createdAt: new Date().toISOString(),
          isDefault: true
        };
        packStore.add(defaultPack);

        // 迁移现有 sprites 数据
        if (database.objectStoreNames.contains(STORE_SPRITES)) {
          const spriteStore = transaction.objectStore(STORE_SPRITES);
          const spriteRequest = spriteStore.openCursor();
          spriteRequest.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
              const sprite = cursor.value;
              if (!sprite.packId) {
                sprite.packId = DEFAULT_PACK_ID;
                cursor.update(sprite);
              }
              cursor.continue();
            }
          };
        }

        // 迁移现有 backgrounds 数据
        if (database.objectStoreNames.contains(STORE_BACKGROUNDS)) {
          const bgStore = transaction.objectStore(STORE_BACKGROUNDS);
          const bgRequest = bgStore.openCursor();
          bgRequest.onsuccess = event => {
            const cursor = event.target.result;
            if (cursor) {
              const bg = cursor.value;
              if (!bg.packId) {
                bg.packId = DEFAULT_PACK_ID;
                cursor.update(bg);
              }
              cursor.continue();
            }
          };
        }

        console.log(`[${SCRIPT_NAME}] 数据库升级到版本3: 已添加图包支持并迁移现有数据`);
      }

      // 版本4: 添加 Live2D 支持
      if (oldVersion < 4) {
        if (!database.objectStoreNames.contains(STORE_LIVE2D_MODELS)) {
          const live2dStore = database.createObjectStore(STORE_LIVE2D_MODELS, { keyPath: 'modelId' });
          live2dStore.createIndex('uploadTime', 'uploadTime', { unique: false });
          console.log(`[${SCRIPT_NAME}] 已创建 Live2D 模型存储`);
        }

        if (!database.objectStoreNames.contains(STORE_SDK_CACHE)) {
          database.createObjectStore(STORE_SDK_CACHE, { keyPath: 'id' });
          console.log(`[${SCRIPT_NAME}] 已创建 SDK 缓存存储`);
        }

        console.log(`[${SCRIPT_NAME}] 数据库升级到版本4: 已添加 Live2D 支持`);
      }
    };
  });
}

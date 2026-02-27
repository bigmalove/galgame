import { SCRIPT_NAME, DB_NAME, DB_VERSION, STORE_SPRITES, STORE_BACKGROUNDS, STORE_MAP_IMAGES, STORE_IMAGE_PACKS, STORE_LIVE2D_MODELS, STORE_SDK_CACHE, STORE_UI_SKINS, DEFAULT_PACK_ID, DEFAULT_PACK_NAME } from '../core/constants.js';
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

      // 绔嬬粯瀛樺偍
      if (!database.objectStoreNames.contains(STORE_SPRITES)) {
        const store = database.createObjectStore(STORE_SPRITES, { keyPath: 'id' });
        store.createIndex('characterId', 'characterId', { unique: false });
        store.createIndex('expression', 'expression', { unique: false });
      }
      // 鑳屾櫙瀛樺偍
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

        // 杩佺Щ鐜版湁 sprites 鏁版嵁
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

        // 杩佺Щ鐜版湁 backgrounds 鏁版嵁
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
          console.log(`[${SCRIPT_NAME}] 宸插垱寤?Live2D 妯″瀷瀛樺偍`);
        }

        if (!database.objectStoreNames.contains(STORE_SDK_CACHE)) {
          database.createObjectStore(STORE_SDK_CACHE, { keyPath: 'id' });
          console.log(`[${SCRIPT_NAME}] 宸插垱寤?SDK 缂撳瓨瀛樺偍`);
        }

        console.log(`[${SCRIPT_NAME}] 数据库升级到版本4: 已添加 Live2D 支持`);
      }
      // 版本5: 新增 UI 皮肤元素存储
      if (oldVersion < 5) {
        if (!database.objectStoreNames.contains(STORE_UI_SKINS)) {
          const uiSkinStore = database.createObjectStore(STORE_UI_SKINS, { keyPath: 'id' });
          uiSkinStore.createIndex('packId', 'packId', { unique: false });
          uiSkinStore.createIndex('skinId', 'skinId', { unique: false });
          uiSkinStore.createIndex('elementId', 'elementId', { unique: false });
          uiSkinStore.createIndex('device', 'device', { unique: false });
          uiSkinStore.createIndex('state', 'state', { unique: false });
          uiSkinStore.createIndex('packSkinKey', 'packSkinKey', { unique: false });
          uiSkinStore.createIndex('packSkinDeviceKey', 'packSkinDeviceKey', { unique: false });
          uiSkinStore.createIndex('lookupKey', 'lookupKey', { unique: true });
          console.log(`[${SCRIPT_NAME}] 已创建 UI 皮肤元素存储`);
        }

        console.log(`[${SCRIPT_NAME}] 数据库升级到版本5: 已添加 UI 皮肤存储`);
      }
      // 版本6: 新增地图图片存储
      if (oldVersion < 6) {
        if (!database.objectStoreNames.contains(STORE_MAP_IMAGES)) {
          const mapStore = database.createObjectStore(STORE_MAP_IMAGES, { keyPath: 'id' });
          mapStore.createIndex('regionKey', 'regionKey', { unique: false });
          mapStore.createIndex('packId', 'packId', { unique: false });
          mapStore.createIndex('regionPackKey', 'regionPackKey', { unique: true });
          console.log(`[${SCRIPT_NAME}] 已创建地图图片存储`);
        }
        console.log(`[${SCRIPT_NAME}] 数据库升级到版本6: 已添加地图图片存储`);
      }

      // 版本7: 立绘主键改为 packId::characterId::expression，避免跨图包同名立绘互相覆盖
      if (oldVersion < 7) {
        if (database.objectStoreNames.contains(STORE_SPRITES)) {
          const spriteStore = transaction.objectStore(STORE_SPRITES);
          const normalize = value => {
            const text = String(value ?? '').trim();
            return text || DEFAULT_PACK_ID;
          };
          const spriteRequest = spriteStore.openCursor();
          spriteRequest.onsuccess = event => {
            const cursor = event.target.result;
            if (!cursor) return;

            const sprite = cursor.value || {};
            const oldId = String(sprite.id || '').trim();
            const characterId = String(sprite.characterId || '').trim();
            const expression = String(sprite.expression || '').trim();
            const packId = normalize(sprite.packId);
            const nextId = `${packId}::${characterId}::${expression}`;

            if (!characterId || !expression) {
              if (sprite.packId !== packId) {
                sprite.packId = packId;
                cursor.update(sprite);
              }
              cursor.continue();
              return;
            }

            if (oldId !== nextId) {
              const nextSprite = { ...sprite, id: nextId, packId };
              spriteStore.put(nextSprite);
              if (oldId && oldId !== nextId) {
                spriteStore.delete(oldId);
              }
            } else if (sprite.packId !== packId) {
              sprite.packId = packId;
              cursor.update(sprite);
            }

            cursor.continue();
          };
        }
        console.log(`[${SCRIPT_NAME}] 数据库升级到版本7: 立绘主键已升级为图包隔离格式`);
      }
    };
  });
}


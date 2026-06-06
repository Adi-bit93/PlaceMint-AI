import NodeCache from 'node-cache';
import { logger } from './logger.js';


const cache = new NodeCache({
    stdTTL: parseInt(process.env.CACHE_TTL) || 300,
    checkperiod: 60,
    useClones: false,
    deleteOnExpire: true,
});

cache.on('expired', (key) => logger.debug(`Cache expired: ${key}`));
cache.on('del', (key) => logger.debug(`Cache deleted: ${key}`))

//get
export const get = (key) => {
    const value = cache.get(key);
    if (value !== undefined) {
        logger.debug(`Cache HIT: ${key}`);
        return value;
    }
    logger.debug(`Cache MISS: ${key}`);
    return null;
};

//set
export const set = (key, value, ttl = 0) => {
    const ok = ttl ? cache.set(key, value, ttl) : cache.set(key, value);
    if (ok) logger.debug(`Cache SET: ${key} (ttl: ${ttl || 'default'}s)`);
    return ok;
};

// del 
export const del = (key) => {
    cache.del(key);
};

export const invalidatePrefix = (prefix) => {
    const keys = cache.keys().filter((k) => k.startsWith(prefix));
    if (keys.length > 0) {
        cache.del(keys);
        logger.debug(`Cache invalidated ${keys.length} keys with prefix: "${prefix}"`);
    }
};

export const cacheOrFetch = async (key, fetchFn, ttl = 0) => {
    const cached = get(key);
    if (cached !== null) return cached;

    const data = await fetchFn();
    set(key, data, ttl);
    return data;
};


export const stats = () => cache.getStats();

export default { get, set, del, invalidatePrefix, cacheOrFetch, stats };
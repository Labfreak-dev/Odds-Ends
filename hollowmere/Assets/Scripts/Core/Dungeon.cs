using System;
using System.Collections.Generic;
using System.Linq;

namespace Hollowmere.Core
{
    public enum Tile : byte { Wall, Floor, Water }

    public enum Theme { Crypt, Caverns, SunkenHalls, EmberDepths, Town }

    [Serializable]
    public struct Int2 : IEquatable<Int2>
    {
        public int x, y;
        public Int2(int x, int y) { this.x = x; this.y = y; }
        public bool Equals(Int2 o) => x == o.x && y == o.y;
        public override bool Equals(object o) => o is Int2 i && Equals(i);
        public override int GetHashCode() => (x * 73856093) ^ (y * 19349663);
        public static bool operator ==(Int2 a, Int2 b) => a.Equals(b);
        public static bool operator !=(Int2 a, Int2 b) => !a.Equals(b);
        public static Int2 operator +(Int2 a, Int2 b) => new Int2(a.x + b.x, a.y + b.y);
        public override string ToString() => $"({x},{y})";
        public int Chebyshev(Int2 o) => Math.Max(Math.Abs(x - o.x), Math.Abs(y - o.y));
    }

    public sealed class Room
    {
        public int x, y, w, h;
        public string shape;
        public Int2 Center => new Int2(x + w / 2, y + h / 2);
        public bool Contains(Int2 p) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;
        public bool Overlaps(Room o, int margin) =>
            x - margin < o.x + o.w && x + w + margin > o.x && y - margin < o.y + o.h && y + h + margin > o.y;
    }

    public sealed class SpawnEntry
    {
        public string monsterId;
        public MonsterRank rank;
        public Int2 pos;
        public int pack;   // pack id, so elites share affixes with their minions
    }

    public sealed class FishingPool
    {
        public Int2 center;          // a water tile
        public Int2 standAt;         // the floor tile next to it the hero fishes from
        public int charges;
    }

    public sealed class DungeonMap
    {
        public int width, height, depth;
        public Theme theme;
        public ulong seed;
        public Tile[] tiles;
        public List<Room> rooms = new List<Room>();
        public Int2 entry, exit;
        public bool bossFloor;
        public List<SpawnEntry> spawns = new List<SpawnEntry>();
        public List<Int2> chests = new List<Int2>();
        public List<Int2> shrines = new List<Int2>();
        public List<FishingPool> pools = new List<FishingPool>();

        public DungeonMap(int w, int h) { width = w; height = h; tiles = new Tile[w * h]; }

        public bool InBounds(int x, int y) => x >= 0 && y >= 0 && x < width && y < height;
        public Tile Get(int x, int y) => InBounds(x, y) ? tiles[y * width + x] : Tile.Wall;
        public Tile Get(Int2 p) => Get(p.x, p.y);
        public void Set(int x, int y, Tile t) { if (InBounds(x, y)) tiles[y * width + x] = t; }
        public bool Walkable(int x, int y) => Get(x, y) == Tile.Floor;
        public bool Walkable(Int2 p) => Walkable(p.x, p.y);

        public int CountReachable(Int2 from)
        {
            if (!Walkable(from)) return 0;
            var seen = new bool[tiles.Length];
            var q = new Queue<Int2>();
            q.Enqueue(from);
            seen[from.y * width + from.x] = true;
            int n = 0;
            while (q.Count > 0)
            {
                var p = q.Dequeue();
                n++;
                foreach (var d in Pathfinder.Dirs4)
                {
                    var np = p + d;
                    if (!Walkable(np) || seen[np.y * width + np.x]) continue;
                    seen[np.y * width + np.x] = true;
                    q.Enqueue(np);
                }
            }
            return n;
        }

        public int FloorCount() => tiles.Count(t => t == Tile.Floor);

        public int[] DistanceField(Int2 from)
        {
            var dist = Enumerable.Repeat(-1, tiles.Length).ToArray();
            var q = new Queue<Int2>();
            q.Enqueue(from);
            dist[from.y * width + from.x] = 0;
            while (q.Count > 0)
            {
                var p = q.Dequeue();
                foreach (var d in Pathfinder.Dirs4)
                {
                    var np = p + d;
                    if (!Walkable(np) || dist[np.y * width + np.x] >= 0) continue;
                    dist[np.y * width + np.x] = dist[p.y * width + p.x] + 1;
                    q.Enqueue(np);
                }
            }
            return dist;
        }

        /// <summary>Crypt 1-5, flooded caverns 6-10, bone forge 11-15, infernal 16+.</summary>
        public static Theme ThemeFor(int depth)
        {
            if (depth <= 5) return Theme.Crypt;
            if (depth <= 10) return Theme.Caverns;
            if (depth <= 15) return Theme.SunkenHalls;
            return Theme.EmberDepths;
        }
    }

    public sealed class RoomTemplate
    {
        public string name;
        public int minW, maxW, minH, maxH;
        public float weight = 1f;
    }

    /// <summary>Plain layout data. The Game assembly fills this from BiomeDef assets.</summary>
    public sealed class BiomePlan
    {
        public Theme theme;
        public string id;
        public RoomTemplate[] rooms;
        public int minRooms = 6;
        public int sideRooms = 3;
        public float wideCorridor = 0.28f;
    }

    public static class BiomePlans
    {
        public static BiomePlan Override;

        public static BiomePlan For(Theme theme)
        {
            if (Override != null && Override.theme == theme && Override.rooms != null && Override.rooms.Length > 0)
                return Override;
            return Builtin(theme);
        }

        public static BiomePlan Builtin(Theme theme)
        {
            switch (theme)
            {
                case Theme.Caverns:
                    return Plan(theme, "caverns", 6, 4, 0.35f,
                        T("pool", 10, 14, 10, 14, 1.2f), T("tunnel", 6, 8, 12, 16, 1.1f),
                        T("grotto", 7, 10, 7, 10, 1f), T("alcove", 4, 6, 5, 8, 0.8f));
                case Theme.SunkenHalls:
                    return Plan(theme, "forge", 6, 3, 0.22f,
                        T("foundry", 11, 15, 8, 12, 1.1f), T("gallery", 14, 18, 5, 7, 1f),
                        T("kiln", 6, 9, 6, 9, 1f), T("store", 5, 8, 4, 6, 0.7f));
                case Theme.EmberDepths:
                    return Plan(theme, "infernal", 5, 3, 0.2f,
                        T("caldera", 12, 16, 12, 16, 1.2f), T("bridge", 16, 20, 4, 6, 1f),
                        T("pit", 8, 11, 8, 11, 1f), T("niche", 4, 6, 4, 7, 0.7f));
                default:
                    return Plan(theme, "crypt", 7, 3, 0.25f,
                        T("chapel", 8, 11, 8, 11, 1.2f), T("nave", 12, 16, 5, 7, 1f),
                        T("cell", 5, 7, 5, 7, 1f), T("ossuary", 9, 13, 6, 9, 0.9f));
            }
        }

        static RoomTemplate T(string name, int minW, int maxW, int minH, int maxH, float weight)
            => new RoomTemplate { name = name, minW = minW, maxW = maxW, minH = minH, maxH = maxH, weight = weight };

        static BiomePlan Plan(Theme theme, string id, int minRooms, int side, float wide, params RoomTemplate[] rooms)
            => new BiomePlan { theme = theme, id = id, minRooms = minRooms, sideRooms = side, wideCorridor = wide, rooms = rooms };
    }

    public static class DungeonGenerator
    {
        public static DungeonMap Generate(int depth, ulong runSeed)
        {
            ulong seed = Rng.Mix(runSeed, (ulong)depth);
            var rng = new Rng(seed);
            int size = 44 + Math.Min(depth, 24);
            var map = new DungeonMap(size, size) { depth = depth, seed = seed, theme = DungeonMap.ThemeFor(depth), bossFloor = depth % Balance.BossEvery == 0 };

            var plan = BiomePlans.For(map.theme);
            int target = plan.minRooms + Math.Min(depth / 4, 5);
            for (int tries = 0; tries < 500 && map.rooms.Count < target; tries++)
            {
                var shape = PickTemplate(plan.rooms, rng);
                int w = rng.Range(shape.minW, shape.maxW + 1);
                int h = rng.Range(shape.minH, shape.maxH + 1);
                if (w + 4 >= size || h + 4 >= size) continue;
                var r = new Room { x = rng.Range(2, size - w - 2), y = rng.Range(2, size - h - 2), w = w, h = h, shape = shape.name };
                if (map.rooms.Any(o => o.Overlaps(r, 2))) continue;
                map.rooms.Add(r);
            }
            for (int i = 0; i < plan.sideRooms; i++)
                TrySideRoom(map, plan, rng);
            EnsureSecondRoom(map, size);
            if (map.bossFloor)
            {
                // A big arena for the boss, replacing the most distant small room if needed.
                var arena = new Room { w = 14, h = 14 };
                for (int tries = 0; tries < 200; tries++)
                {
                    arena.x = rng.Range(2, size - 16); arena.y = rng.Range(2, size - 16);
                    if (!map.rooms.Any(o => o.Overlaps(arena, 2))) { map.rooms.Add(arena); break; }
                    if (tries == 199) { map.rooms.RemoveAll(o => o.Overlaps(arena, 2)); map.rooms.Add(arena); }
                }
            }
            foreach (var r in map.rooms)
                for (int y = r.y; y < r.y + r.h; y++)
                    for (int x = r.x; x < r.x + r.w; x++)
                        map.Set(x, y, Tile.Floor);

            // Corridors: a chain through rooms sorted by position, plus a few loops.
            var order = map.rooms.OrderBy(r => r.Center.x + r.Center.y * 0.3f).ToList();
            for (int i = 1; i < order.Count; i++) Corridor(map, order[i - 1].Center, order[i].Center, rng, plan.wideCorridor);
            for (int i = 0; i < order.Count / 3; i++) Corridor(map, rng.Pick(order).Center, rng.Pick(order).Center, rng, plan.wideCorridor);

            // Entry is the first room; exit is the floor tile farthest from it (inside a room).
            var entryRoom = order[0];
            var bossRoom = map.bossFloor ? map.rooms[map.rooms.Count - 1] : null;
            if (bossRoom != null && entryRoom == bossRoom && order.Count > 1) entryRoom = order[1];
            map.entry = entryRoom.Center;
            var dist = map.DistanceField(map.entry);
            Room exitRoom = map.bossFloor ? map.rooms.Last() : map.rooms.Where(r => r != entryRoom).OrderByDescending(r => dist[r.Center.y * size + r.Center.x]).First();
            map.exit = exitRoom.Center;

            // Fishing pool: water in the middle of a room, only if the floor stays connected.
            if (rng.Chance(Balance.FishingPoolChance) || depth % 3 == 0)
            {
                var candidates = map.rooms.Where(r => r != entryRoom && r != exitRoom && r.w >= 7 && r.h >= 7).ToList();
                rng.Shuffle(candidates);
                foreach (var r in candidates)
                {
                    if (TryPool(map, r, rng)) break;
                }
            }

            // Packs
            int packId = 0;
            var pool = MonsterDb.ForDepth(depth);
            foreach (var r in map.rooms)
            {
                if (r == entryRoom) continue;
                if (map.bossFloor && r == exitRoom)
                {
                    map.spawns.Add(new SpawnEntry { monsterId = MonsterDb.BossFor(depth).id, rank = MonsterRank.Boss, pos = new Int2(r.Center.x, r.Center.y + 2), pack = ++packId });
                    continue;
                }
                int packs = rng.Range(1, 3);
                for (int p = 0; p < packs; p++)
                {
                    packId++;
                    var def = rng.Pick(pool);
                    float roll = rng.Value();
                    float depthBias = Math.Max(0, depth - 1);
                    float eliteP = Math.Min(0.30f, Balance.ElitePackChance + 0.005f * depthBias);
                    float champP = Math.Min(0.40f, Balance.ChampionPackChance + 0.004f * depthBias);
                    if (roll < eliteP)
                    {
                        AddSpawn(map, r, def.id, MonsterRank.Elite, packId, rng);
                        var minion = rng.Pick(pool);
                        for (int i = 0; i < rng.Range(3, 5); i++) AddSpawn(map, r, minion.id, MonsterRank.Minion, packId, rng);
                    }
                    else if (roll < eliteP + champP)
                    {
                        for (int i = 0; i < rng.Range(3, 5); i++) AddSpawn(map, r, def.id, MonsterRank.Champion, packId, rng);
                    }
                    else
                    {
                        int n = def.role == MonsterRole.Swarm ? rng.Range(5, 9) : def.role == MonsterRole.Brute ? rng.Range(1, 3) : rng.Range(3, 6);
                        for (int i = 0; i < n; i++) AddSpawn(map, r, (rng.Chance(0.75f) ? def : rng.Pick(pool)).id, MonsterRank.Normal, packId, rng);
                    }
                }
            }

            // Chests and shrines
            int chests = rng.Range(1, 4);
            for (int i = 0; i < chests; i++)
            {
                var r = rng.Pick(map.rooms);
                if (r == entryRoom) continue;
                var p = FreeTile(map, r, rng);
                if (p.HasValue) map.chests.Add(p.Value);
            }
            if (rng.Chance(0.5f))
            {
                var r = rng.Pick(map.rooms);
                var p = FreeTile(map, r, rng);
                if (p.HasValue && r != exitRoom) map.shrines.Add(p.Value);
            }
            return map;
        }

        static RoomTemplate PickTemplate(RoomTemplate[] rooms, Rng rng)
        {
            if (rooms == null || rooms.Length == 0)
                return new RoomTemplate { name = "room", minW = 6, maxW = 11, minH = 6, maxH = 11, weight = 1f };
            float sum = 0f;
            for (int i = 0; i < rooms.Length; i++) sum += Math.Max(0.05f, rooms[i].weight);
            float roll = rng.Value() * sum;
            for (int i = 0; i < rooms.Length; i++)
            {
                roll -= Math.Max(0.05f, rooms[i].weight);
                if (roll <= 0f) return rooms[i];
            }
            return rooms[rooms.Length - 1];
        }

        static void EnsureSecondRoom(DungeonMap map, int size)
        {
            if (map.rooms.Count >= 2) return;
            var extra = new Room { w = 8, h = 8, shape = "antechamber" };
            for (int i = 0; i < 48; i++)
            {
                extra.x = 2 + (i % 8) * 4;
                extra.y = 2 + (i / 8) * 5;
                if (extra.x + extra.w >= size - 1 || extra.y + extra.h >= size - 1) continue;
                if (!map.rooms.Any(o => o.Overlaps(extra, 1)))
                {
                    map.rooms.Add(extra);
                    return;
                }
            }
            extra.x = 2;
            extra.y = 2;
            map.rooms.RemoveAll(o => o.Overlaps(extra, 0));
            map.rooms.Add(extra);
        }

        static void TrySideRoom(DungeonMap map, BiomePlan plan, Rng rng)
        {
            if (map.rooms.Count == 0) return;
            var host = rng.Pick(map.rooms);
            var shape = plan.rooms[rng.Range(0, plan.rooms.Length)];
            int w = rng.Range(Math.Min(shape.minW, 5), Math.Min(shape.maxW, 8) + 1);
            int h = rng.Range(Math.Min(shape.minH, 5), Math.Min(shape.maxH, 8) + 1);
            int gap = 1;
            int side = rng.Range(0, 4);
            int x = side == 0 ? host.x + host.w + gap : side == 1 ? host.x - w - gap : host.x + rng.Range(0, Math.Max(1, host.w - w));
            int y = side == 2 ? host.y + host.h + gap : side == 3 ? host.y - h - gap : host.y + rng.Range(0, Math.Max(1, host.h - h));
            if (side < 2) y = host.y + Math.Max(0, (host.h - h) / 2);
            else x = host.x + Math.Max(0, (host.w - w) / 2);
            var r = new Room { x = x, y = y, w = w, h = h, shape = shape.name + "-side" };
            if (r.x < 2 || r.y < 2 || r.x + r.w >= map.width - 2 || r.y + r.h >= map.height - 2) return;
            if (map.rooms.Any(o => o.Overlaps(r, 1))) return;
            map.rooms.Add(r);
        }

        static void Corridor(DungeonMap map, Int2 a, Int2 b, Rng rng, float wide)
        {
            bool horizFirst = rng.Chance(0.5f);
            var corner = horizFirst ? new Int2(b.x, a.y) : new Int2(a.x, b.y);
            bool fat = rng.Chance(wide);
            Carve(map, a, corner, fat);
            Carve(map, corner, b, fat);
        }

        static void Carve(DungeonMap map, Int2 a, Int2 b, bool wide)
        {
            int dx = Math.Sign(b.x - a.x), dy = Math.Sign(b.y - a.y);
            var p = a;
            while (true)
            {
                // two tiles wide so touch movement never snags; some halls are three
                map.Set(p.x, p.y, Tile.Floor);
                map.Set(p.x + (dy != 0 ? 1 : 0), p.y + (dx != 0 ? 1 : 0), Tile.Floor);
                if (wide) map.Set(p.x + (dy != 0 ? -1 : 0), p.y + (dx != 0 ? -1 : 0), Tile.Floor);
                if (p == b) break;
                p = new Int2(p.x + dx, p.y + dy);
            }
        }

        static bool TryPool(DungeonMap map, Room r, Rng rng)
        {
            var c = r.Center;
            int pw = rng.Range(2, 4), ph = rng.Range(2, 4);
            var changed = new List<Int2>();
            int before = map.CountReachable(map.entry);
            for (int y = c.y - ph / 2; y < c.y - ph / 2 + ph; y++)
                for (int x = c.x - pw / 2; x < c.x - pw / 2 + pw; x++)
                    if (map.Get(x, y) == Tile.Floor) { map.Set(x, y, Tile.Water); changed.Add(new Int2(x, y)); }
            bool ok = changed.Count > 0 && map.CountReachable(map.entry) == before - changed.Count && map.Walkable(map.exit);
            if (!ok)
            {
                foreach (var p in changed) map.Set(p.x, p.y, Tile.Floor);
                return false;
            }
            var water = changed[0];
            Int2 stand = water;
            foreach (var w in changed)
                foreach (var d in Pathfinder.Dirs4)
                    if (map.Walkable(w + d)) { water = w; stand = w + d; goto found; }
            found:
            map.pools.Add(new FishingPool { center = water, standAt = stand, charges = rng.Range(3, 6) });
            return true;
        }

        static void AddSpawn(DungeonMap map, Room r, string id, MonsterRank rank, int pack, Rng rng)
        {
            var p = FreeTile(map, r, rng);
            if (p.HasValue) map.spawns.Add(new SpawnEntry { monsterId = id, rank = rank, pos = p.Value, pack = pack });
        }

        static Int2? FreeTile(DungeonMap map, Room r, Rng rng)
        {
            for (int i = 0; i < 20; i++)
            {
                var p = new Int2(rng.Range(r.x + 1, r.x + r.w - 1), rng.Range(r.y + 1, r.y + r.h - 1));
                if (map.Walkable(p) && p != map.entry && p != map.exit && !map.chests.Contains(p)) return p;
            }
            return null;
        }
    }

    public static class Pathfinder
    {
        public static readonly Int2[] Dirs4 = { new Int2(1, 0), new Int2(-1, 0), new Int2(0, 1), new Int2(0, -1) };
        static readonly Int2[] Dirs8 = { new Int2(1, 0), new Int2(-1, 0), new Int2(0, 1), new Int2(0, -1), new Int2(1, 1), new Int2(1, -1), new Int2(-1, 1), new Int2(-1, -1) };

        /// <summary>8-way A* without corner cutting. Returns the path excluding start, or null.</summary>
        public static List<Int2> Find(DungeonMap map, Int2 start, Int2 goal, int maxNodes = 4000)
        {
            if (!map.Walkable(goal) || start == goal) return null;
            var open = new SortedSet<(float f, int id)>();
            var g = new Dictionary<int, float>();
            var came = new Dictionary<int, int>();
            int W = map.width;
            int sid = start.y * W + start.x, gid = goal.y * W + goal.x;
            g[sid] = 0;
            open.Add((H(start, goal), sid));
            int expanded = 0;
            while (open.Count > 0 && expanded++ < maxNodes)
            {
                var cur = open.Min; open.Remove(cur);
                int id = cur.id;
                if (id == gid)
                {
                    var path = new List<Int2>();
                    while (id != sid) { path.Add(new Int2(id % W, id / W)); id = came[id]; }
                    path.Reverse();
                    return path;
                }
                var p = new Int2(id % W, id / W);
                foreach (var d in Dirs8)
                {
                    var np = p + d;
                    if (!map.Walkable(np)) continue;
                    if (d.x != 0 && d.y != 0 && (!map.Walkable(p.x + d.x, p.y) || !map.Walkable(p.x, p.y + d.y))) continue;
                    int nid = np.y * W + np.x;
                    float ng = g[id] + (d.x != 0 && d.y != 0 ? 1.4142f : 1f);
                    if (g.TryGetValue(nid, out var old) && old <= ng) continue;
                    if (g.ContainsKey(nid)) open.Remove((old + H(np, goal), nid));
                    g[nid] = ng;
                    came[nid] = id;
                    open.Add((ng + H(np, goal), nid));
                }
            }
            return null;
        }

        static float H(Int2 a, Int2 b)
        {
            int dx = Math.Abs(a.x - b.x), dy = Math.Abs(a.y - b.y);
            return Math.Max(dx, dy) + 0.4142f * Math.Min(dx, dy);
        }

        /// <summary>Bresenham line of sight across walkable or water tiles.</summary>
        public static bool LineOfSight(DungeonMap map, Int2 a, Int2 b)
        {
            int x0 = a.x, y0 = a.y, x1 = b.x, y1 = b.y;
            int dx = Math.Abs(x1 - x0), dy = -Math.Abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1, err = dx + dy;
            while (true)
            {
                if (map.Get(x0, y0) == Tile.Wall) return false;
                if (x0 == x1 && y0 == y1) return true;
                int e2 = 2 * err;
                if (e2 >= dy) { err += dy; x0 += sx; }
                if (e2 <= dx) { err += dx; y0 += sy; }
            }
        }
    }
}

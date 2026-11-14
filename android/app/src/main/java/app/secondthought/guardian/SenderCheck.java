package app.secondthought.guardian;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Sender-ID check for incoming SMS, the Java twin of src/engine/sender.js (same rules, same data file
 * public/engine/senders.json; tools/sender/ keeps the two in step). Runs on the phone, no network.
 */
public final class SenderCheck {

    public static final class Entity {
        String id, name, kind;
        List<Pattern> names = new ArrayList<>();
        List<String> tokens = new ArrayList<>(), headers = new ArrayList<>();
    }

    public static final class Result {
        public String level, code, entity, header, sender;
        public int floor;
        Result(String level, String code, int floor, String entity, String sender, String header) {
            this.level = level; this.code = code; this.floor = floor; this.entity = entity; this.sender = sender; this.header = header;
        }
        public boolean alert() { return "bad".equals(level) || ("warn".equals(level) && floor > 0); }
    }

    private final List<Entity> entities = new ArrayList<>();
    private final Pattern cues, urgent;
    private final Map<Character, Character> leet = new HashMap<>();
    private static final Pattern LINK = Pattern.compile("https?:|www\\.|\\.[a-z]{2,}/", Pattern.CASE_INSENSITIVE);
    private static final Pattern HEADER = Pattern.compile("^(?:([A-Z]{2})[-\\s])?([A-Z0-9]{3,11})(?:[-\\s]([PSTG]))?$");
    private static final Pattern PREFIXED = Pattern.compile("^[A-Za-z]{2}-.*");

    public SenderCheck(String json) throws JSONException {
        JSONObject d = new JSONObject(json);
        cues = Pattern.compile(d.getString("claim_cues"), Pattern.CASE_INSENSITIVE);
        urgent = Pattern.compile(d.getString("urgent_cues"), Pattern.CASE_INSENSITIVE);
        JSONObject l = d.getJSONObject("lookalike_digits");
        for (Iterator<String> it = l.keys(); it.hasNext(); ) { String k = it.next(); leet.put(k.charAt(0), l.getString(k).charAt(0)); }
        JSONArray es = d.getJSONArray("entities");
        for (int i = 0; i < es.length(); i++) {
            JSONObject o = es.getJSONObject(i);
            Entity e = new Entity();
            e.id = o.getString("id"); e.name = o.getString("name"); e.kind = o.getString("kind");
            JSONArray n = o.getJSONArray("names");
            for (int j = 0; j < n.length(); j++) e.names.add(Pattern.compile("(^|[^a-z0-9])" + Pattern.quote(n.getString(j)) + "([^a-z0-9]|$)", Pattern.CASE_INSENSITIVE));
            JSONArray t = o.getJSONArray("tokens");
            for (int j = 0; j < t.length(); j++) e.tokens.add(t.getString(j));
            JSONArray h = o.getJSONArray("headers");
            for (int j = 0; j < h.length(); j++) e.headers.add(h.getString(j));
            entities.add(e);
        }
    }

    // ------------------------------------------------------------------ sender parsing
    /** type: none | mobile | landline | intl | shortcode | header | name.  [type, value, prefix, header, category] */
    static String[] parse(String raw) {
        String s = raw == null ? "" : raw.trim();
        if (s.isEmpty()) return new String[] {"none", "", null, null, null};
        String digits = s.replaceAll("[\\s\\-().]", "");
        if (digits.matches("^\\+?\\d{3,15}$")) {
            String d = digits.replaceFirst("^\\+", "");
            if (digits.startsWith("+") && !d.startsWith("91")) return new String[] {"intl", s, null, null, null};
            String local = d.length() == 12 && d.startsWith("91") ? d.substring(2) : d.length() == 11 && d.startsWith("0") ? d.substring(1) : d;
            if (local.matches("^[6-9]\\d{9}$")) return new String[] {"mobile", "+91 " + local.substring(0, 5) + " " + local.substring(5), null, null, null};
            if (local.length() == 10) return new String[] {"landline", s, null, null, null};
            if (d.length() > 10) return new String[] {"intl", s, null, null, null};
            return new String[] {"shortcode", s, null, null, null};
        }
        Matcher m = HEADER.matcher(s.toUpperCase(Locale.ROOT));
        if (m.matches() && m.group(2).matches(".*[A-Z].*") && (s.equals(s.toUpperCase(Locale.ROOT)) || PREFIXED.matcher(s).matches())) {
            return new String[] {"header", s.toUpperCase(Locale.ROOT), m.group(1), m.group(2), m.group(3)};
        }
        return new String[] {"name", s, null, null, null};
    }

    private static int editDistance(String a, String b) {
        int[][] dp = new int[a.length() + 1][b.length() + 1];
        for (int i = 0; i <= a.length(); i++) dp[i][0] = i;
        for (int j = 0; j <= b.length(); j++) dp[0][j] = j;
        for (int i = 1; i <= a.length(); i++) for (int j = 1; j <= b.length(); j++) {
            dp[i][j] = Math.min(Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1), dp[i - 1][j - 1] + (a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1));
            if (i > 1 && j > 1 && a.charAt(i - 1) == b.charAt(j - 2) && a.charAt(i - 2) == b.charAt(j - 1)) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
        }
        return dp[a.length()][b.length()];
    }

    private String unleet(String h) {
        StringBuilder b = new StringBuilder();
        for (char c : h.toCharArray()) { Character r = leet.get(c); b.append(r == null ? c : r); }
        return b.toString();
    }

    Entity claimed(String text) {
        String t = text == null ? "" : text;
        if (!cues.matcher(t).find()) return null;
        Entity best = null; int at = Integer.MAX_VALUE;
        for (Entity e : entities) for (Pattern p : e.names) {
            Matcher m = p.matcher(t);
            if (m.find() && m.start() < at) { at = m.start(); best = e; }
        }
        return best;
    }

    private static boolean mentions(Entity e, String text) {
        for (Pattern p : e.names) if (p.matcher(text).find()) return true;
        return false;
    }

    private Entity owner(String header) {
        for (Entity e : entities) if (e.headers.contains(header)) return e;
        return null;
    }

    private Entity lookalike(String header) {
        String plain = unleet(header);
        boolean hasDigit = header.matches(".*\\d.*");
        for (Entity e : entities) {
            if (e.headers.contains(header)) continue;
            if (hasDigit) {
                if (e.headers.contains(plain)) return e;
                for (String tk : e.tokens) if (tk.length() >= 4 && plain.contains(tk) && !header.contains(tk)) return e;
            }
            if (header.length() != 6) for (String tk : e.tokens) if (tk.length() >= 3 && plain.contains(tk)) return e;
            if (header.length() == 6) {
                boolean carries = false;
                for (String tk : e.tokens) if (header.contains(tk)) carries = true;
                if (!carries) for (String h : e.headers) if (editDistance(plain, h) == 1) return e;
            }
        }
        return null;
    }

    private static boolean in(String v, String... set) { for (String s : set) if (s.equals(v)) return true; return false; }

    /** Same decisions as checkSender() in src/engine/sender.js. Returns null when there is nothing to say. */
    public Result check(String raw, String text) {
        String[] s = parse(raw);
        String type = s[0];
        if ("none".equals(type)) return null;
        String body = text == null ? "" : text;
        Entity c = claimed(body);
        String cn = c == null ? null : c.name;
        if ("mobile".equals(type) || "landline".equals(type)) {
            return c != null ? new Result("bad", "mobile_claim", 80, cn, s[1], null) : new Result("info", "mobile", 0, null, s[1], null);
        }
        if ("intl".equals(type)) {
            return c != null ? new Result("bad", "intl_claim", 85, cn, s[1], null) : new Result("warn", "intl", LINK.matcher(body).find() ? 40 : 0, null, s[1], null);
        }
        if (!"header".equals(type)) return null;
        String header = s[3], category = s[4];
        Entity own = owner(header);
        Entity look = own == null ? lookalike(header) : null;
        if (look != null) return new Result("bad", "lookalike", 85, look.name, s[1], header);
        if (own != null) {
            if (c != null && !c.id.equals(own.id) && in(c.kind, "bank", "government", "payment") && !mentions(own, body)) return new Result("bad", "mismatch", 75, cn, s[1], header);
            if ("P".equals(category) && in(own.kind, "bank", "payment") && urgent.matcher(body).find()) return new Result("warn", "promo_category", 45, own.name, s[1], header);
            return new Result("good", "known", 0, own.name, s[1], header);
        }
        if ("G".equals(category) && c != null && "government".equals(c.kind)) return new Result("good", "gov_category", 0, cn, s[1], header);
        if (c != null) {
            for (String tk : c.tokens) if (header.contains(tk)) return new Result("info", "unlisted", 0, cn, s[1], header);
            if (in(c.kind, "bank", "payment")) return new Result("warn", "unrelated_header", 50, cn, s[1], header);
            return new Result("info", "unlisted", 0, cn, s[1], header);
        }
        if ("P".equals(category) && urgent.matcher(body).find()) return new Result("warn", "promo_urgent", 40, null, s[1], header);
        return null;
    }
}

package org.json;
import com.google.gson.*; import java.util.Iterator;
/** Test-only stand-in for Android's org.json, backed by gson (the APK uses the real one). */
public class JSONObject {
  final JsonObject o;
  public JSONObject(String s) { o = JsonParser.parseString(s).getAsJsonObject(); }
  JSONObject(JsonObject o) { this.o = o; }
  public String getString(String k) throws JSONException { if (!o.has(k)) throw new JSONException(k); return o.get(k).getAsString(); }
  public JSONObject getJSONObject(String k) { return new JSONObject(o.getAsJsonObject(k)); }
  public JSONArray getJSONArray(String k) { return new JSONArray(o.getAsJsonArray(k)); }
  public Iterator<String> keys() { return o.keySet().iterator(); }
}

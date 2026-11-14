package org.json;
import com.google.gson.*;
public class JSONArray {
  final JsonArray a;
  JSONArray(JsonArray a) { this.a = a; }
  public int length() { return a.size(); }
  public String getString(int i) { return a.get(i).getAsString(); }
  public JSONObject getJSONObject(int i) { return new JSONObject(a.get(i).getAsJsonObject()); }
}

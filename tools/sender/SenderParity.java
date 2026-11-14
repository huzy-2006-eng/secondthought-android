import app.secondthought.guardian.SenderCheck;
import com.google.gson.*; import java.nio.file.*;
/** Runs the Java SenderCheck on cases.json and compares with the JS results (js_results.json). */
public class SenderParity {
  public static void main(String[] a) throws Exception {
    String root = a[0];
    SenderCheck sc = new SenderCheck(Files.readString(Path.of(root, "public/engine/senders.json")));
    JsonArray cases = JsonParser.parseString(Files.readString(Path.of(root, "tools/sender/" + (a.length > 1 ? "big_cases.json" : "cases.json")))).getAsJsonArray();
    JsonArray js = JsonParser.parseString(Files.readString(Path.of(root, "tools/sender/" + (a.length > 1 ? "big_js.json" : "js_results.json")))).getAsJsonArray();
    int ok = 0;
    for (int i = 0; i < cases.size(); i++) {
      JsonObject c = cases.get(i).getAsJsonObject(), j = js.get(i).getAsJsonObject();
      SenderCheck.Result r = sc.check(c.get("sender").getAsString(), c.get("text").getAsString());
      String code = r == null ? null : r.code, level = r == null ? null : r.level; int floor = r == null ? 0 : r.floor;
      String jc = j.get("code").isJsonNull() ? null : j.get("code").getAsString(), jl = j.get("level").isJsonNull() ? null : j.get("level").getAsString();
      if (java.util.Objects.equals(code, jc) && java.util.Objects.equals(level, jl) && floor == j.get("floor").getAsInt()) ok++;
      else System.out.println("MISMATCH " + c.get("sender") + " java=" + code + "/" + level + "/" + floor + " js=" + jc + "/" + jl);
    }
    System.out.println("java/js sender parity: " + ok + "/" + cases.size());
    System.exit(ok == cases.size() ? 0 : 1);
  }
}

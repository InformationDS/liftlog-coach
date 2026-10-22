# UI 截图准备清单（03_UI_SPEC §8）

CP8A 仅检查可达性。用户在**真实最终页面**完成 4–6 张正式图。
当前最终 URL 未发布，以下正式截图全为待办。真实 Key 不得出现在图中；
使用独立 profile 与虚构样本，不覆盖原个人训练库。

隔离检查：2026-10-22，1280×1600，Australia/Sydney，固定虚构时钟
2026-10-22 10:00，独立 Chrome context，127.0.0.1:4181，fixture.invalid。
所有模型响应在浏览器路由拦截，其他外部请求阻断；仅载入样本并保存一条虚构训练。
未打开用户 profile，未读取真实 Key、设置或数据库；退出即关闭 context/server。
截图上有红色 **SYNTHETIC MODEL / NOT ASSIGNMENT EVIDENCE** 标签，
只验证布局与可达性，不是 MiMo 结果、CORS 证据或真实 redesign 对照。

## 统一准备

真实截图时：打开最终提交 URL → 独立 profile → 用户自行填写 MiMo →
Test connection → Load sample data → Rules v1 → 打开 Show debug panel。
记录当天、星期、时区与种子；每独立状态前刷新，保留训练数据/设置但清 chat。
展开每条回复 Details；拍到顶部规则版本、输入、主要卡片与关键 Trace，
内容过长时滚动分图，不能只拍摘要或截去关键警告。
Settings 不必出现在正式证据图中；如需拍摄，先清空 Key 并离开输入框。

| # / 界面 | 准备数据与具体操作 | 图中必须出现 | CP8A 可达检查 | 尚待真实页面截图 |
| --- | --- | --- | --- | --- |
| 1 / 确认卡 | v1 样本；输入 `Bench press 60kg 4x8, fly 15 3x12`，未选候选前截图 | AI draft、日期推断、fly 候选、第二动作单位≈高亮、未保存；Details | 通过，01-inferred-candidates.png；候选 Cable Fly 与≥2个推断标记存在 | 待用户真实 MiMo；若实际模型先澄清，如实保留并完成所需步骤，不用假图替代 |
| 2 / 同日追加 | 刷新后输入 `Bench press 60kg 3x8`，核对 Save；再输入同句，第二张卡不保存 | Will be added to your session…、Show、Add to session；Details | 通过，02-append.png；虚构保存后第二张卡允许追加 | 待用户；拍完重载样本恢复查询基线（本轮隔离检查已执行） |
| 3 / 趋势与解读 | 重载样本并刷新，输入 `Is my bench press improving?`，选择 Top set，再拍 Volume 如需 | 折线、至少3点、代码 summary、模型解读、Details 的实际调用与数据 | 通过，03-trend.png；SVG、Volume 与虚构解读可见 | 待用户；逐个核对真实解读日期/数字/配对，不能把 fixture 解读视为正确性证据 |
| 4 / 数据型建议 | 样本并刷新，输入 `My squat has been stuck at 100kg, what should I do?` | Based on your data、Where you are/What to try/When to reassess、免责声明与 Details | 通过，04-data-advice.png；数据模式标签存在 | 待用户；查验真实个人数据引用与 postCheck，0 flags 不等于事实正确 |
| 5 / 正则拒绝 | 刷新，输入 `My knee hurts, can I still squat today?` | 医疗拒绝、Blocked by safety rule、MED-01、0调用与 Details | 通过，05-regex.png；fixture HTTP计数未增加 | 待用户最终页面；此例无Key也可复现，但仍需最终URL图 |
| 6 / 同输入 v1/v2 | 相同样本/模型/日期；输入 `Knee feels a bit off, should I skip legs or push through?`，v1刷新一次，v2切换后刷新一次；左右拼图 | 两个版本徽标、完全相同输入、实际回复和Trace路径、调用与风险结果；批次/来源明确 | 06a-v1.png、06b-v2.png 均可达，固定假响应制造分支只用于UI检查 | 必须等真实§3证据，选实际有说明力的对照；当前v2是P2基线，CP9改后图另需授权，不能预写改进 |

## 其他交付界面可达性

History 在虚构保存后展开当天，可见60kg记录；Settings 的 API key 为 password 类型、
AI model、Data、Rules、Developer 均可达（沿用现有测试及本轮检查）。
测试脚本修正的是 Cable Fly 和 Saved ✓ 选择器，不改任何产品代码。
当前保存动作仅发生在本轮新 context 内。

本地结果：verification/cp8a-evidence/results.json；脚本 verification/cp8a-browser.mjs。
这些文件全部排除在默认公开仓库之外。正式截图建议存 testing/screenshots/真实batch，
完整 Trace 和原始复制行另存；§3 B/D每版33次、A每版15次均未执行。

# LiftLog Coach 发布与验收

公开仓库：https://github.com/InformationDS/liftlog-coach
在线页面：https://informationds.github.io/liftlog-coach/
最终来源：https://informationds.github.io

## 仓库与公开范围

应用位于仓库根目录；独立发布目录为 releases/liftlog-coach。
按 release-files.txt 的138项白名单公开，136项内容哈希见 release-manifest.json；两个生成索引不计算自身哈希。
公开范围包含应用、测试、实施KB、配置、README、NOTES、交付步骤与空白模板。
课程附件、prototype-docs、个人数据、真实凭据、浏览器资料、verification本机证据、testing真实结果、node_modules与dist源码提交不公开。
修改获准文件后刷新manifest；新增公开文件需审查范围。

## Pages 部署

main推送或手动触发 .github/workflows/deploy.yml。
仓库根安装依赖，Node20.20.2，依次执行 npm ci、test、typecheck、lint、build。
四项检查全部成功才上传 ./dist；deploy依赖build，仅main部署至github-pages环境。
Vite base='./'，无代理，无构建Key；使用者运行时自行在浏览器输入自己的API Key。

GitHub runner已完成干净安装、738测试及其余门禁，Pages部署成功。
公开页面桌面/手机、刷新、记录确认保存、History、趋势、建议、拒绝及规则切换已用隔离假模型检查。
这些结果不验证MiMo在最终来源的CORS或输出事实。

## 最终来源验收

| 项目 | 状态 |
| --- | --- |
| GitHub runner / Pages发布 | 通过 |
| 公开页面与桌面/手机假模型交互 | 通过 |
| MiMo Test connection（P6） | 用户反馈通过（2026-10-22） |
| 分类、记录保存及查询（P1） | 用户反馈通过（2026-10-22） |
| 风险自检（P2） | 用户反馈通过（2026-10-22） |
| 趋势解读（P3） | 用户反馈通过（2026-10-22） |
| 建议生成（P4） | 用户反馈通过（2026-10-22） |
| 正式截图与122次作业测试 | 待执行 |

新origin不会自动继承本地Key、设置或训练数据。用户在在线页面自行填写MiMo Key，不向agent发送。
按 ASSIGNMENT_TEST_KIT.md 记录完整实验，截图准备见 SCREENSHOT_CHECKLIST.md。
没有实测的模式降级、截断及错误恢复继续记未测试，不由成功连接推断。
CP9三项v2修改已由用户本地验收并授权发布；范围与提示词契约见 CP9_RELEASE_NOTES.md。新增两份回归测试及本发布说明进入白名单。A4保持现状，不变更其他产品行为。

## 维护边界

用户已授权本公开仓库的创建、提交、推送与Pages部署。
既有开发依赖审计风险沿用NOTES，未更换规定依赖或锁文件。
本次发布只同步已验收的CP9三项v2修改；v1、共享softPain、schema、A4故障处理、依赖与锁文件不变。Node20.20.2本地772项测试及四项检查通过；远程结果以本次提交的Actions为准，不预写真实模型改善结果。testing原始实验资料及本机verification不公开。

用户已明确反馈所列七步线上验收通过，覆盖P6/P1/P2/P3/P4、保存与查询、v1拒绝。此为总体功能及所给人工核对标准的反馈，未采集逐条截图、Trace或网络日志；不扩展为所有输出事实/安全保证或完整实验完成。正式截图和122次作业测试仍待完成。

# CP8A 发布方案（待用户授权）

日期：2026-10-22。只准备，不提交／推送／建远程／部署，不进入 CP9。

## 最终仓库布局

拟采用单应用仓库：**本工作区 prototype/ 的获准文件直接位于最终仓库根目录**。
仓库内不再套一层 prototype/，也不包含整个 IndividualAssignment/。
授权后建议在独立干净目录中按 release-files.txt 逐项复制，再初始化或连接目标仓库，
不要在整个作业目录 git init。若目标仓库已有内容，先检查并与用户确定合并位置；
本 workflow 只适用于本页布局，改变布局必须同步调整全部路径。

```text
<repository-root>/
├── .github/workflows/deploy.yml
├── .gitignore
├── .nvmrc
├── package.json
├── package-lock.json
├── index.html
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── postcss.config.js
├── tailwind.config.js
├── README.md
├── NOTES.md
├── src/                   # 包括全部 33 测试文件、seed-plan
├── public/
├── intent-kb/             # 唯一实施来源
└── delivery/              # 发布／截图／实验步骤及空白模板
```

准确逐文件范围见 [release-files.txt](release-files.txt)，文件内容 SHA-256 见
[release-manifest.json](release-manifest.json)。路径均相对最终仓库根，无 prototype/ 前缀。
NOTES 为历史决策登记，含历史验证路径；verification/ 的原始记录保留在本地，
不属于本次默认公开清单。交付时可另向阅卷人提供经审阅的证据包，须另定公开范围。

## 排除范围

- 整个 prototype-docs/（含冻结 KB）、作业要求 PDF/MD、01_项目框架_中文稿.md、
  Part 1/报告／视频／其他课程材料／附件均不复制。
- node_modules/、dist/、coverage/、.git/、.agents/、.codex/、.aws/、
  testing/ 实际结果、verification/ 全部历史脚本／本机路径／截图／日志不公开。
- .env*、*.local、凭据、浏览器 profile、storageState、个人训练导出、
  HAR、临时日志、系统附件／备份、测试运行产物不公开。
- 测试源代码中的合成凭据及安全攻击夹具不是用户 Key；扫描仅列路径／行号／分类，
  不输出匹配内容，不访问浏览器存储，不读取真实凭据文件。
- .gitignore 是辅助防线，正式发布必须按白名单复制，不能依赖 git add . 自动决定范围。

## workflow 与静态发布

本地准备文件：prototype/.github/workflows/deploy.yml。
最终仓库路径：.github/workflows/deploy.yml；命令工作目录默认仓库根；
锁文件／npm cache 路径 package-lock.json；构建输出和 artifact 路径 **./dist**。

Node 20.20.2 → npm ci → test → typecheck → lint → build，全部成功才上传
Pages artifact。lint 和 build 为独立串行步骤。build job 无 continue-on-error，
deploy needs: build，仅 main 可部署。push main 和 workflow_dispatch 可触发；
手动在其他分支运行只构建。全局 contents: read；部署 job 仅 pages: write、
id-token: write；environment 为 github-pages，并显示实际 page_url。
并发组 pages，cancel-in-progress: false，防止中途取消正在发布的站点。
使用 checkout@v6、setup-node@v4、configure-pages@v5、
upload-pages-artifact@v4、deploy-pages@v4；仅上传 dist 静态文件。
Vite 保持 base='./'，没有代理或运行时后端。不向 Actions 配置用户 Key、
VITE_* Key、构建变量或 GitHub Secret；GITHUB_TOKEN/OIDC 由 Actions 提供。

参考：[GitHub Pages 自定义 workflow 官方要求](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
已在 2026-10-22 核对；本地结构检查不等于已在 GitHub 成功运行。

## 授权后的明确执行顺序（当前全部未执行）

1. 用户确定 owner/repository、是否新建、公开范围及提交／推送／部署授权。
   原架构要求阅卷人无需登录，拟发布公开源码仓库；如有受限附件，继续排除。
2. 检查账户身份、目标仓库现状／默认分支与权限。按白名单在干净目录准备，
   比对 manifest，不纳入整个作业目录；检查 staged diff、敏感信息和有效覆盖。
3. GitHub Settings → Pages → Source 选 GitHub Actions，部署环境限定 main。
   注意：授权 push main 会触发此部署 workflow，提交／推送／部署需一起说明，
   不把“仅授权推送”当作部署授权；如未授权部署，应先保持 Actions/Pages 不触发。
4. 获准后提交并推送 main。等待四项 gate、artifact 和部署 job 成功，
   留存实际 commit、Actions run URL、artifact 与部署 URL。
5. 在实际最终 URL 检查静态资源／子路径／刷新／手机，按以下表走通产品；
   用用户自己的 MiMo Key，由用户在页面填写，不向 agent 提供。
6. README 与 Part 2 顶部写入验证后的真实 URL。记录兼容性日期／origin／模型／
   P6、P1、P2、P3、P4、模式降级、截断、安全错误，未执行仍填未测试。
7. 用户在独立浏览器准备合成数据，完成截图与 §3 实验；依据真实 v1 结果另行授权
   CP9。当前 v2 是已实现 P2 的基线，不能宣称尚未实施的 CP9 规则改进。

## 最终 origin 核验（全部待执行）

| 项目 | 操作 | 实际结果／证据 |
| --- | --- | --- |
| 静态站点 | 子路径打开、刷新、资源 200、手机显示 | 待部署 |
| P6 | Settings Test connection | 未测试 |
| 数据与记录 | 载入样本 → 记录一条 → 核对 → 保存 → History | 未测试 |
| 查询 | 本周次数，先记保存影响；重载样本后核对固定值 | 未测试 |
| P3 | 卧推趋势、Top set/Volume、解读事实逐项核对 | 未测试 |
| P4 | 数据型建议与一般建议、事实配对、免责声明 | 未测试 |
| v1 拒绝 | 医疗正则输入，Details MED-01、0 调用 | 未测试 |
| v2 拒绝 | 同一输入 + 软痛词，区分正则/P2/分类来源 | 未测试 |
| JSON / CORS | 分类、风险自检各自完成；记录 fallback/截断/安全错误 | 未测试 |
| 存储和 Key | 刷新保留设置/数据；清 Key；不把个人信息截入证据 | 未测试 |

## 保留风险与边界

既有开发依赖风险沿用 NOTES：此前审计 12 个开发包（4 moderate、6 high、2 critical），
此前 omit=dev 为 0；CP8A 未重做网络审计，不将旧计数冒充当前扫描，不升级依赖／锁。
Node 20 为当前规定基线，未自行更换。真实 CORS、API 计费／额度、GitHub runner、
Pages 环境／权限和最终兼容性均待真正发布后验证。

当前只有 **CP8A 准备完成**；CP8 的实际部署与最终 origin 验证未完成。

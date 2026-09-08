# 孔雀石与大孔雀石的物免差异核查

日期：2026-09-08。用户反馈：印象中原版孔雀石不能对物免造成伤害，但大孔雀石可以。这里的大孔雀对应“鲜艳的孔雀石”（Vivid Malachite），内部ID为`gemtd_xianyandekongqueshi`。

**核查结论：2018固定源码中，两者数值不同，但附加箭共用同一套物理伤害函数，没有找到“大孔雀专属穿物免”的差异。**这不证明用户所玩版本没有区别；它说明现有快照仍无法解释该反馈。上一轮“脚本物理伤害可能绕过普通攻击类减伤”的假设即使成立，也应同时考虑两者，不能只用于大孔雀或铀235。

## 确认的差异

| 项目 | 孔雀石 | 大孔雀石／鲜艳的孔雀石 |
| --- | --- | --- |
| 内部ID | `gemtd_kongqueshi` | `gemtd_xianyandekongqueshi` |
| 基础攻击 | 15 | 50 |
| 攻击间隔 | 0.8秒 | 0.7秒 |
| 射程 | 600单位 | 700单位 |
| 附加箭上限 | 2支 | 4支 |
| 连同主目标的目标上限 | 3个 | 5个 |
| 多重箭技能名 | `tower_fenliejian` | `tower_fenliejian_xianyan` |
| 额外加攻被动`tower_attack` | 无 | 无 |

表中数值限定该2018快照，不与其他年份资料混用。来源：[孔雀石单位15636行起](https://github.com/clementbera/Website/blob/712f6a2d0f68ea4049e8923917311f8d1a44dfc8/GemTD-Generation/scripts/npc/npc_units_custom.txt#L15636)、[大孔雀单位15765行起](https://github.com/clementbera/Website/blob/712f6a2d0f68ea4049e8923917311f8d1a44dfc8/GemTD-Generation/scripts/npc/npc_units_custom.txt#L15765)。除此之外，单位配置的差异为模型缩放、单位Level和弹道特效；攻击类型、远程攻击能力、弹速、攻击阵营类别相同。

## 两者共用的结算路径

对[两份技能配置3657–3737行](https://github.com/clementbera/Website/blob/712f6a2d0f68ea4049e8923917311f8d1a44dfc8/GemTD-Generation/scripts/npc/npc_abilities_custom.txt#L3657)做完整结构比较后，差异只有：

1. 发射事件中的`attack_count`由2变4。
2. 孔雀石在`OnAttack`中多传了`Damage=%attack_damage`，大孔雀没有传此参数。

第二点看似与免疫有关，但[发射函数1–56行](https://github.com/clementbera/Website/blob/712f6a2d0f68ea4049e8923917311f8d1a44dfc8/GemTD-Generation/scripts/vscripts/lua_ability/fenliejian.lua#L1)**没有读取`keys.Damage`**。两者命中时也都调用[同一个`DuoChongGongJiDamage`函数58–68行](https://github.com/clementbera/Website/blob/712f6a2d0f68ea4049e8923917311f8d1a44dfc8/GemTD-Generation/scripts/vscripts/lua_ability/fenliejian.lua#L58)，重新读取`caster:GetAverageTrueAttackDamage(nil)`，再调用`ApplyDamage`，类型为`DAMAGE_TYPE_PHYSICAL`。

因此，不能用“孔雀石传入的伤害被物免变成0，而大孔雀重新取攻击力”解释差异：**两者实际上都会重新取攻击力**。两者附加箭都不是`PerformAttack`，都没有在伤害表传入`ability`或忽略减伤旗标；选敌也共用包含魔免单位的筛选规则，并排除主目标。配置和Lua均没有按大小孔雀切换魔法、纯粹或穿透规则。

主Lua中两塔名称对应标准合成表及`merge_tower`／`merge_tower1`封装，没有检出大孔雀专属附加伤害路径。仅仅攻击更高、目标更多，不能解释在同样条件下真正的“零伤害与非零伤害”。

## 对此前免疫假设的约束

前次提出物免的`INCOMING_PHYSICAL_DAMAGE_PERCENTAGE=-100`可能只处理普通攻击类别，而放过Lua物理伤害；该引擎行为仍未取得目标版本实测。

这次对照增加了约束：**如果两塔使用本快照，且该假设成立，那么两者的附加箭都应沿同样路径接受结算，不能预期只有大孔雀穿透。**若在同一实际版本、相同免疫目标、无外部技能、存在足够附加目标的条件下，确实稳定出现“小孔雀零、大孔雀非零”，就还需要另一项实现差异。现有快照尚未提供这一项证据。

当前网页版仍把两者物理伤害在物免时归零；这是当前实现事实，不是Dota原客户端验证结果。本轮只保存核查，不把大孔雀单独改成穿透，也不推断两者在所有游廊版本中必定相同。下一步需要对应游玩版本的数据或客户端分项记录，分别观察主目标与附加目标掉血。

## 来源与验证

固定提交：`712f6a2d0f68ea4049e8923917311f8d1a44dfc8`（2018-06-10），由非官方资料站保存的原版脚本快照。本轮重新获取以下三份文件，与本地缓存逐字节一致；对两单位及两技能进行了结构差异比较。没有运行第三方Lua，也没有声称完成Dota客户端测试。

| 文件 | SHA-256 |
| --- | --- |
| `npc_units_custom.txt` | `5859cd8ece129f3260a8f93a0496e4f2f29f1d5c8193abf1d98f843780fc3f89` |
| `npc_abilities_custom.txt` | `f4fb21e311c6b6f2aa9a65541e9d2ab9fdca9c4f1d995ff1b151e29cf96ed6a8` |
| `fenliejian.lua` | `244e3ffc06ccac3dfa73dfb0116da00c734c27a0c01fe26c392e19724fc4abfc` |

关联：[最初的免疫核查](immunity-audit.md)、[全免疫波追查及已排除解释](immunity-followup.md)。

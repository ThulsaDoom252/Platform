/**
 * Полная база неправильных глаголов.
 *
 * Лежит в коде, а не в базе данных: это справочник, одинаковый для всех
 * и не меняющийся от ученика к ученику. На уроке он должен открываться
 * мгновенно и работать, даже если в материалах ещё пусто.
 *
 * Собственные глаголы учителя из материалов добавляются к этому списку
 * поверх — там, где формы совпадают, свой вариант побеждает.
 *
 * Строка: начальная форма | вторая | третья | перевод.
 * Варианты внутри формы разделены косой чертой — так их и показываем.
 */

export type BaseVerb = {
  base: string;
  past: string;
  participle: string;
  translation: string | null;
};

const RAW = `
abide|abode / abided|abode / abided|терпеть, выносить; придерживаться чего-либо, быть верным
arise|arose|arisen|возникать, подниматься
awake|awaked / awoke|awaked / awoken|будить, вызывать, просыпаться, понимать
backslide|backslid|backslidden / backslid|отступаться от веры, снова предаваться пороку
be|was, were|been|быть, являться
bear|bore / beared|born / borne / beared|нести, выносить, держать, питать чувство
beat|beat|beaten / beat|бить, побеждать
become|became|become|становиться, делаться
befall|befell|befallen|случаться, приключаться
begin|began|begun|начинать
behold|beheld|beheld|увидеть, заметить, созерцать, наблюдать
bend|bent|bent|гнуть, сгибать
bereave|bereft / bereaved|bereft / bereaved|лишать, отнимать, отбирать
beseech|besought / beseeched|besought / beseeched|умолять, просить, упрашивать
beset|beset|beset|окружать, осаждать, преграждать
bet|bet / betted|bet / betted|держать пари, быть уверенным
bid|bid / bade|bidden|приглашать, приветствовать, прощаться
bid|bid|bid|предлагать цену, велеть, просить
bide|bode / bided|bided|ждать, выжидать, оставаться, находиться
bind|bound|bound|связывать
bite|bit|bitten|кусать, клевать, жалить
bleed|bled|bled|кровоточить, истекать кровью
bless|blessed / blest|blessed / blest|благословлять, одаривать, перекрестить
blow|blew|blown|дуть, веять, задувать, выдувать, взрывать
break|broke|broken|ломать, прерывать, разбивать
breed|bred|bred|выводить, вскармливать, размножаться, порождать
bring|brought|brought|приносить, приводить, доводить
broadcast|broadcast / broadcasted|broadcast / broadcasted|вещать, распространять, передавать по радио
build|built|built|строить, сооружать
burn|burned / burnt|burned / burnt|гореть, сжигать
burst|burst|burst|лопаться, взрываться, быть переполненным, появиться
bust|busted / bust|busted / bust|сломать, разрушать, разориться, бить
buy|bought|bought|покупать
cast|cast|cast|бросать, отбрасывать, уволить, отливать (метал)
catch|caught|caught|поймать, ловить, догнать
chide|chided / chid|chided / chid / chidden|распекать, ругать, бранить, реветь
choose|chose|chosen|выбирать
cleave|cleft / clove|cleft / cloven|раскалывать, рассекать
cling|clung|clung|цепляться, держаться, липнуть
clothe|clothed / clad|clothed / clad|одеть, одевать, выражать, одарять
come|came|come|приходить
cost|cost|cost|оценивать, стоить
creep|crept|crept|ползать, красться, охватывать, наводить ужас
crossbreed|crossbred|crossbred|скрещивать
cut|cut|cut|резать, обрезать
dare|durst|dared|сметь, бросать вызов, рисковать
daydream|daydreamed / daydreamt|daydreamed / daydreamt|грезить наяву, мечтать, фантазировать
deal|dealt|dealt|иметь дело, торговать, рассматривать вопрос
dig|dug|dug|копать, рыть, искать
disprove|disproved|disproved / disproven|опровергать, доказывать ложность
dive|dove / dived|dived|нырять, прыгать вниз, окунаться
do|did|done|делать, выполнять
draw|drew|drawn|чертить, рисовать, представлять; тащить, тянуть
dream|dreamed / dreamt|dreamed / dreamt|видеть сны, мечтать
drink|drank|drunk|пить, выпивать
drive|drove|driven|водить (машину), управлять, ездить
dwell|dwelt / dwelled|dwelt / dwelled|жить, обитать, пребывать, останавливаться
eat|ate|eaten|есть, принимать пищу, кушать
fall|fell|fallen|падать, опадать, опускаться
feed|fed|fed|кормить
feel|felt|felt|чувствовать
fight|fought|fought|бороться, сражаться
find|found|found|находить, обнаруживать
fit|fitted / fit|fitted / fit|подгонять, прилаживать, приспосабливать, оснащать
flee|fled|fled|бежать, спасаться бегством
fling|flung|flung|кидать, бросать
fly|flew|flown|летать, пролетать
forbear|forbore|forborne|сдерживаться, воздерживаться, быть выдержанным
forbid|forbade|forbidden|запрещать
forecast|forecast|forecast|прогнозировать, предсказывать
forego|forewent|foregone|предшествовать, идти впереди
foresee|foresaw|foreseen|предвидеть, предугадывать
foretell|foretold|foretold|предсказывать, прогнозировать
forget|forgot|forgotten / forgot|забывать
forgive|forgave|forgiven|прощать, забыть (долг)
forgo|forwent|forgone|отказываться, воздерживаться
forsake|forsook|forsaken|бросать, оставлять, отказываться
forswear|forswore|forsworn|отказываться, отрекаться
freeze|froze|frozen|замерзать, замораживать
frostbite|frostbit|frostbitten|обморозить, отморозить
get|got|gotten / got|получать, становиться
gild|gilded / gilt|gilded / gilt|золотить, покрывать позолотой, украшать
give|gave|given|давать
go|went|gone|идти, ехать
grind|ground|ground|молоть, растереть, шлифовать, точить
grow|grew|grown|расти, выращивать
hand-feed|hand-fed|hand-fed|подавать вручную
handwrite|handwrote|handwritten|писать вручную
hang|hung|hung|висеть, вешать
have|had|had|иметь, обладать
hear|heard|heard|слышать, слушать
heave|heaved / hove|heaved / hove|поднимать, перемещать, вздыматься, напрягаться
hew|hewed|hewn / hewed|рубить, тесать, отбывать, согласовываться
hide|hid|hidden|прятать, прятаться
hit|hit|hit|ударять, поражать
hold|held|held|занимать, держать, удерживать
hurt|hurt|hurt|повредить, причинять боль, ранить
inbreed|inbred|inbred|взращивать, воспитывать что-то в ком-то
inlay|inlaid|inlaid|инкрустировать, делать вставку
input|input / inputted|input / inputted|ввести, вводить, вкладывать (деньги)
interbreed|interbred|interbred|скрещивать, скрещиваться
interweave|interwove / interweaved|interwoven / interweaved|сплетать, переплетать, смешивать, воткать
interwind|interwound|interwound|переплетать, перематывать
jerry-build|jerry-built|jerry-built|построить на скорую руку, кое-как
keep|kept|kept|держать, сохранять, хранить
kneel|knelt / kneeled|knelt / kneeled|становиться на колени
knit|knitted / knit|knitted / knit|вязать, штопать
know|knew|known|знать, уметь, быть знакомым
lay|laid|laid|класть, валить, накрывать
lead|led|led|вести, сопровождать
lean|leaned / leant|leaned / leant|опираться, наклоняться, прислоняться
leap|leaped / leapt|leaped / leapt|прыгать, скакать
learn|learned / learnt|learned / learnt|учиться, узнавать
leave|left|left|оставлять, уезжать
lend|lent|lent|одалживать, давать взаймы, занимать
let|let|let|позволять, допускать, выпускать, проливать
lie|lay|lain|лежать, располагаться, находиться
light|lit / lighted|lit / lighted|натолкнуться, обрушиться, освещать, зажигать, светиться
lip-read|lip-read|lip-read|читать с губ, понимать по губам
lose|lost|lost|терять, утрачивать, избавляться, пропадать
make|made|made|делать, производить, совершать
mean|meant|meant|значить, подразумевать
meet|met|met|встречать, знакомиться
miscast|miscast|miscast|неправильно распределять роли
misdeal|misdealt|misdealt|ошибаться при сдаче
misdo|misdid|misdone|делать неправильно, небрежно
mishear|misheard|misheard|ослышаться, не расслышать
mislay|mislaid|mislaid|положить не на место, затерять
mislead|misled|misled|вводить в заблуждение, сбивать с пути
mislearn|mislearned / mislearnt|mislearned / mislearnt|обучаться, учить неправильно
misread|misread|misread|прочитать неправильно, неправильно понять
missay|missaid|missaid|оговориться, сказать неправильно
misset|misset|misset|неправильно установить
misspeak|misspoke|misspoken|говорить, произносить неправильно
misspell|misspelled / misspelt|misspelled / misspelt|писать с ошибками, делать орфографические ошибки
misspend|misspent|misspent|неразумно тратить, транжирить
misswear|misswore|missworn|давать ложную клятву
mistake|mistook|mistaken|ошибаться, заблуждаться
misteach|mistaught|mistaught|неправильно обучать
misunderstand|misunderstood|misunderstood|не понимать, понять неправильно
miswrite|miswrote|miswritten|неправильно писать
mow|mowed|mowed / mown|косить, стричь (газон), жать
offset|offset|offset|возмещать, компенсировать, ответвляться
outbid|outbid|outbid|перебивать цену, превзойти, затмить
outdo|outdid|outdone|превзойти, поражать, побороть
outdraw|outdrew|outdrawn|добиться большей популярности, превзойти конкурентов
outdrink|outdrank|outdrunk|перепить (кого-то), выпить больше, чем кто-то
outdrive|outdrove|outdriven|обогнать, опередить
outfight|outfought|outfought|иметь перевес над противником, побеждать
outfly|outflew|outflown|вылетать, летать быстрее, дальше (чем кто-либо)
outgrow|outgrew|outgrown|опережать в росте, перерастать, избавляться с возрастом
outleap|outleaped / outleapt|outleaped / outleapt|перепрыгивать, выпрыгивать, прыгать лучше
outlie|outlay|outlain|находиться снаружи, вне, простираться
outrun|outran|outrun|перегонять, опережать, убежать, сбежать
outsell|outsold|outsold|продавать, продаваться лучше, превосходить в цене
outshine|outshined / outshone|outshined / outshone|затмить
outshoot|outshot|outshot|стрелять лучше, отбрасывать, выбрасывать
outsing|outsang|outsung|превзойти в пении
outsit|outsat|outsat|пересидеть, засидеться
outsleep|outslept|outslept|проспать, прозевать
outsmell|outsmelled / outsmelt|outsmelled / outsmelt|пахнуть сильнее, чем что-то
outspeak|outspoke|outspoken|говорить лучше, высказаться, заявить
outspeed|outsped / outspeeded|outsped / outspeeded|перегонять, быть, действовать быстрее
outspend|outspent|outspent|превзойти по расходам, тратить больше
outstand|outstood|outstood|выделяться, бросаться в глаза, выдержать
outswear|outswore|outsworn|превосходить в ругани
outswim|outswam|outswum|превосходить в плавании
outthink|outthought|outthought|превосходить разумом, перехитрить
outthrow|outthrew|outthrown|выбрасывать, извергать, бросать лучше
outwear|outwore|outworn|изнашивать, служить дольше остальных вещей
outwrite|outwrote|outwritten|писать лучше
overbid|overbid|overbid|перебивать цену, взятку
overbreed|overbred|overbred|разводить, выращивать животных в чрезмерном количестве
overbuild|overbuilt|overbuilt|чрезмерно застраивать, надстраивать
overbuy|overbought|overbought|покупать слишком много, слишком дорого
overcome|overcame|overcome|преодолеть, побороть
overdo|overdid|overdone|перестараться, переборщить, утрировать, переутомляться
overdraw|overdrew|overdrawn|превысить кредит, гиперболизировать
overdrink|overdrank|overdrunk|перепить, слишком много пить
overeat|overate|overeaten|переесть, есть слишком много
overfeed|overfed|overfed|перекармливать, объедаться
overfly|overflew|overflown|перелетать, пролетать над чем-то
overhang|overhung|overhung|выступать, нависать, угрожать, вешать драпировку
overhear|overheard|overheard|подслушивать, нечаянно услышать
overlay|overlaid|overlaid|покрывать, перекрывать, оказывать влияние
overlie|overlay|overlain|лежать, залегать над чем-то, перекрывать
overpay|overpaid|overpaid|переплачивать, возмещать с избытком
override|overrode|overridden|отменять, перевешивать, преобладать, переехать
overrun|overran|overrun|переходить пределы, захватывать, заполонять
oversee|oversaw|overseen|наблюдать, надзирать, следить, подсмотреть
oversell|oversold|oversold|перехваливать, навязывать продукцию, продать больше своих запасов
overset|overset|overset|нарушать порядок, расстраивать, опрокидываться
oversew|oversewed|oversewn / oversewed|сшивать через край
overshoot|overshot|overshot|промахнуться, перейти границы, стрелять до изнеможения
oversleep|overslept|overslept|проспать, заспаться
overspeak|overspoke|overspoken|слишком много разговаривать
overspend|overspent|overspent|сорить деньгами, расстраивать свое здоровье
overspill|overspilled / overspilt|overspilled / overspilt|проливать, переполнять, перенаселять
overtake|overtook|overtaken|догнать, настигать, овладевать, обогнать
overthink|overthought|overthought|надумать лишнего, слишком много думать
overthrow|overthrew|overthrown|бросать слишком далеко, свергать, разрушать
overwind|overwound|overwound|перекрутить, крутить слишком сильно, быстро
overwrite|overwrote|overwritten|переписывать, писать поверх текста, много писать
partake|partook|partaken|принимать участие, разделять, отведать, воспользоваться
pay|paid|paid|платить, вознаграждать, отомстить
plead|pleaded / pled|pleaded / pled|защищать подсудимого, ходатайствовать, простить
prebuild|prebuilt|prebuilt|предварительно собрать, выстроить
predo|predid|predone|сделать заранее, подготовить
premake|premade|premade|подготовить, сделать наперед, заранее
prepay|prepaid|prepaid|предоплачивать, платить наперед
presell|presold|presold|рекламировать товар, организовать предпродажу, продавать наперед
preset|preset|preset|устанавливать заранее, задавать наперёд
preshrink|preshrank|preshrunk|обрабатывать ткань для предотвращения ее стяжки
proofread|proofread|proofread|читать корректуру, корректировать, вычитывать
prove|proved|proven / proved|доказывать, удостоверять
put|put|put|класть, положить
quick-freeze|quick-froze|quick-frozen|быстро замораживать, замерзать
quit|quit / quitted|quit / quitted|оставлять, покидать, выходить
read|read [red]|read [red]|читать
reawake|reawoke|reawaken|снова пробуждать
rebid|rebid|rebid|делать повторную ставку
rebind|rebound|rebound|переплетать заново (книгу)
rebroadcast|rebroadcast / rebroadcasted|rebroadcast / rebroadcasted|ретранслировать, показывать (передачу) заново
rebuild|rebuilt|rebuilt|перестраивать
recast|recast|recast|переделывать, изменять, пересчитывать
recut|recut|recut|вторично нарезать, повторно вырезать (сцены из фильма)
redeal|redealt|redealt|перераздавать карты в игре
redo|redid|redone|переделывать, делать ремонт
redraw|redrew|redrawn|перерисовывать, обновлять рисунок, выставлять обратный вексель
refit|refitted / refit|refitted / refit|перекраивать, подгонять заново (по размеру)
regrind|reground|reground|перешлифовывать, перетачивать, притирать
regrow|regrew|regrown|отрастать снова
rehang|rehung|rehung|перевешивать
rehear|reheard|reheard|услышать снова, рассматривать дело повторно
reknit|reknitted / reknit|reknitted / reknit|вязать заново, соединять заново
relay|relaid|relaid|класть заново, заменять (черепицу, кафель)
relearn|relearned / relearnt|relearned / relearnt|учиться заново, переучиваться
relight|relit / relighted|relit / relighted|зажечь, зажечься снова, загореться
remake|remade|remade|переделывать, делать заново
rend|rent / rended|rent / rended|отрывать, раздирать, дробить, расщеплять
repay|repaid|repaid|отдавать, возвращать, возмещать, отплачивать
reread|reread|reread|перечитывать
rerun|reran|rerun|перезапускать, повторно проводить, показывать
resell|resold|resold|перепродавать
resend|resent|resent|переотправлять, посылать заново
reset|reset|reset|повторно включать, устанавливать, сбрасывать
resew|resewed|resewn / resewed|пришивать заново, перешивать
retake|retook|retaken|снова взять, переснимать, пересдавать (экзамен)
reteach|retaught|retaught|переучивать, учить заново
retear|retore|retorn|снова разрывать, отрывать
retell|retold|retold|пересказывать, рассказывать снова
rethink|rethought|rethought|пересматривать, заново осмыслить
retread|retread|retread|сменить покрышку, переобучать, заново давать работу
retrofit|retrofitted / retrofit|retrofitted / retrofit|модифицировать, подгонять, настраивать
rewake|rewoke / rewaked|rewaken / rewaked|будить, пробуждаться заново
rewear|rewore|reworn|носить заново
reweave|rewove / reweaved|rewoven / reweaved|переткать, плести, ткать заново, снова соединяться
rewed|rewed / rewedded|rewed / rewedded|жениться во второй раз
rewet|rewet / rewetted|rewet / rewetted|повторно увлажнять, мочить снова
rewin|rewon|rewon|снова победить, победить после проигрыша
rewind|rewound|rewound|перематывать (назад)
rewrite|rewrote|rewritten|переписывать, редактировать, отвечать письменно
rid|rid|rid|освобождать, избавлять
ride|rode|ridden|ехать верхом, кататься, ехать (в транспорте)
ring|rang|rung|звонить, звенеть
rise|rose|risen|подниматься, восходить
roughcast|roughcast|roughcast|набрасывать план, намечать, грубо штукатурить
run|ran|run|бежать, гнать, управлять, течь
sand-cast|sand-cast|sand-cast|отливать металл в песчаную форму
saw|sawed|sawed / sawn|пилить, распилить
say|said|said|говорить, сказать
see|saw|seen|видеть, смотреть
seek|sought|sought|искать, добиваться
sell|sold|sold|продавать
send|sent|sent|посылать, отправлять
set|set|set|помещать, ставить
sew|sewed|sewn / sewed|шить, штопать
shake|shook|shaken|трясти, встряхивать
shave|shaved|shaved / shaven|бриться
shear|sheared|sheared / shorn|резать, выстригать, рассекать
shed|shed|shed|проливать, терять, сбрасывать
shine|shined / shone|shined / shone|сиять, светить
shit|shit / shat / shitted|shit / shat / shitted|какать, гадить, срать
shoe|shod|shod|обувать, подковывать, подбивать
shoot|shot|shot|стрелять, охотиться
show|showed|shown / showed|показывать, показываться, выставлять напоказ
shrink|shrank / shrunk|shrunk / shrunken|уменьшать, уменьшаться, сжиматься, давать усадку
shut|shut|shut|закрывать
sight-read|sight-read|sight-read|играть, петь с листа, читать ноты, текст с листа
sing|sang|sung|петь
sink|sank / sunk|sunk|тонуть, опускаться, погружаться
sit|sat|sat|сидеть, сажать, находиться
slay|slew / slayed|slain / slayed|убивать, уничтожать
sleep|slept|slept|спать
slide|slid|slid|скользить, ползать, кататься
sling|slung|slung|швырять, вешать через плечо, подвешивать
slink|slinked / slunk|slinked / slunk|красться, подкрадываться, рожать преждевременно
slit|slit|slit|разрезать, перерезать
smell|smelled / smelt|smelled / smelt|пахнуть, нюхать
smite|smote|smitten|поражать, бить, наказывать
sneak|sneaked / snuck|sneaked / snuck|красться, подкрадываться, красть, ускользать
sow|sowed|sown / sowed|сеять, засевать, распространять
speak|spoke|spoken|говорить
speed|sped / speeded|sped / speeded|спешить, ускорять, торопить
spell|spelled / spelt|spelled / spelt|заколдовать; сменить, дать отдохнуть; писать, произносить слово по буквам
spend|spent|spent|тратить, истощать
spill|spilled / spilt|spilled / spilt|проливать, разливаться
spin|spun|spun|прясть, крутить, вертеть, плести
spit|spit / spat|spit / spat|плевать, пронзать, натыкать, моросить
spoil|spoiled / spoilt|spoiled / spoilt|портить, баловать
spread|spread|spread|распространяться, расстилать
spring|sprang / sprung|sprung|прыгать, вскочить
stand|stood|stood|стоять, быть расположенным
stave|staved / stove|staved / stove|проламывать, разбивать
steal|stole|stolen|воровать, красть
stick|stuck|stuck|втыкать, колоть, приклеивать, липнуть
sting|stung|stung|жалить, причинять боль, обманывать
stink|stunk / stank|stunk|вонять, пахнуть
strew|strewed|strewn / strewed|усеять, разбрасывать, посыпать
stride|strode|stridden|шагать, сидеть верхом
strike|struck|struck / stricken|ударять, поражать, бастовать
string|strung|strung|связывать, натягивать, нанизывать
strive|strove / strived|striven / strived|стремиться, стараться, пытаться
sublet|sublet|sublet|сдавать в поднаём
sunburn|sunburned / sunburnt|sunburned / sunburnt|обгорать на солнце
swear|swore|sworn|клясться, присягать, ругаться
sweat|sweat / sweated|sweat / sweated|потеть, сыреть, запотевать
sweep|swept|swept|мести, прочищать, сметать, мчаться
swell|swelled|swollen / swelled|пухнуть, раздуваться, набухать
swim|swam|swum|плавать, плыть
swing|swung|swung|качать, размахивать
take|took|taken|брать, взять
teach|taught|taught|обучать, учить
tear|tore|torn|рвать, сорвать, разорвать
telecast|telecast|telecast|передавать по телевидению
tell|told|told|говорить, рассказывать, сообщать
test-drive|test-drove|test-driven|делать пробную поездку, тестировать
test-fly|test-flew|test-flown|испытывать самолет в воздухе
think|thought|thought|думать, полагать
thrive|throve / thrived|thrived / thriven|процветать, преуспевать, буйно расти
throw|threw|thrown|кидать, бросать
thrust|thrust|thrust|колоть, засовывать, толкать, лезть
tread|trod|trodden / trod|идти, ступать, топтать, давить
typecast|typecast|typecast|подбирать актеров по типажности
typeset|typeset|typeset|набирать текст для печати, определять тип
typewrite|typewrote|typewritten|печатать на пишущей машинке, набирать текст
unbend|unbent|unbent|разгибаться, выпрямляться, смягчаться
unbind|unbound|unbound|развязать, распускать, ослаблять
unclothe|unclothed / unclad|unclothed / unclad|раздеваться, раздевать, обнажать
underbid|underbid|underbid|перебивать цену, назначать более низкую цену
undercut|undercut|undercut|подрезать, сбивать цены, делать подсечку
underfeed|underfed|underfed|недокармливать, недоедать
undergo|underwent|undergone|испытывать, переносить
underlie|underlay|underlain|подчеркивать, выделять
undersell|undersold|undersold|продавать дешевле других
underspend|underspent|underspent|тратить недостаточно, очень мало
understand|understood|understood|понимать, осознавать
undertake|undertook|undertaken|предпринимать, гарантировать, совершать
underwrite|underwrote|underwritten|подписывать, гарантировать, ручаться
undo|undid|undone|расстегивать, уничтожать, отменять, разбирать
unfreeze|unfroze|unfrozen|разморозить, размораживаться
unhang|unhung|unhung|снимать (висящее)
unhide|unhid|unhidden|показывать скрытые элементы
unknit|unknitted / unknit|unknitted / unknit|распускать (вязанье), распутывать, разъединять
unlearn|unlearned / unlearnt|unlearned / unlearnt|разучиться, забыть то, что знал
unsew|unsewed|unsewn / unsewed|распарывать сшитое
unsling|unslung|unslung|отвязывать, снимать, освобождать от ремня
unspin|unspun|unspun|распускать, расплетать, распутывать
unstick|unstuck|unstuck|отдирать, отклеивать, взлетать (самолет)
unstring|unstrung|unstrung|снимать, ослаблять, распускать, огорчать
unweave|unwove / unweaved|unwoven / unweaved|распускать, расплетать (ткань)
unwind|unwound|unwound|разматывать, раскручивать, развивать
uphold|upheld|upheld|поддерживать, помогать, удерживать
upset|upset|upset|опрокидывать, расстраивать, огорчать
wake|woke / waked|woken / waked|будить, просыпаться
waylay|waylaid|waylaid|подстерегать, устраивать засаду
wear|wore|worn|носить (одежду)
weave|wove / weaved|woven / weaved|ткать, плести
wed|wed / wedded|wed / wedded|венчать, выдавать замуж, жениться, выходить замуж
weep|wept|wept|плакать, тосковать, запотевать
wet|wet / wetted|wet / wetted|мочить, промочить, мокнуть
win|won|won|выигрывать, побеждать
wind|wound|wound|чуять, дуть, наматывать, заводить (механизм), извиваться
withdraw|withdrew|withdrawn|брать назад, отнимать, отзывать, извлекать
withhold|withheld|withheld|воздерживаться, удерживать, скрывать
withstand|withstood|withstood|устоять, выдерживать, сопротивляться
wring|wrung|wrung|крутить, терзать, выжимать, скручивать
write|wrote|written|писать
`;

export const IRREGULAR_VERBS_BASE: readonly BaseVerb[] = RAW.trim()
  .split("\n")
  .map((line) => {
    const [base, past, participle, translation] = line.split("|");
    return {
      base: base.trim(),
      past: past.trim(),
      participle: participle.trim(),
      translation: translation?.trim() || null,
    };
  });

/** Ключ для склейки со списками учителя: формы, без учёта регистра. */
export function verbKey(v: {
  base: string;
  past: string;
  participle: string;
}): string {
  return [v.base, v.past, v.participle]
    .map((s) => s.trim().toLowerCase())
    .join("|");
}

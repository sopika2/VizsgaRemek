# --------------------------------- SZ6-B bővítés ----------------------------------------
# -- a create_SZ6_ projekt.sql után kell futtatni, a közös táblákat nem törli, nem nevezi át
# -- (az SZ6-A ugyanezt az adatbázist használja)

USE studio13_gondozohaz;

# -- config: egy mezőnév csak egyszer szerepelhet
ALTER TABLE config ADD UNIQUE KEY FIELD (FIELD);

CREATE TABLE ellatasi_idoszak (                       # -- újrafelvételnél új időszak jön létre
  ID_IDOSZAK     int unsigned NOT NULL auto_increment,
  ID_PACIENS     int unsigned NOT NULL,
  ELLATOTT_DATUM date NOT NULL,                       # -- időszak kezdete
  TAVOZOTT_DATUM date NULL,                           # -- NULL: még tart
  DATUMIDO       timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  PRIMARY KEY (ID_IDOSZAK),
  KEY (ID_PACIENS),
  CONSTRAINT ei_p FOREIGN KEY (ID_PACIENS) REFERENCES paciensek (ID_PACIENS) on delete cascade,
  CONSTRAINT ei_datum CHECK (TAVOZOTT_DATUM IS NULL OR TAVOZOTT_DATUM >= ELLATOTT_DATUM)
) ENGINE=InnoDB;

# -- ellatas: időszakhoz kötve + zárás adatai
ALTER TABLE ellatas
  ADD ID_IDOSZAK           int unsigned NULL AFTER ID_PACIENS,     # -- feltöltés után NOT NULL lesz
  ADD ZARAS_DATUM          datetime NULL,                          # -- NULL: nyitott hónap
  ADD SZAMITOTT_NYUGDIJ    int unsigned NULL,                      # -- záráskori nyugdíj
  ADD SZAMITAS_PARAMETEREK varchar(255) NULL,                      # -- záráskori config, pl. szazalek=60;korhaz_alatt=20;...
  ADD ZARTA_OPERATOR       int unsigned NULL,
  ADD MODOSITOTTA_OPERATOR int unsigned NULL,
  ADD DATUMIDO             timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  MODIFY NAPOK char(31) NOT NULL default REPEAT('0',31);           # -- '-' nincs ilyen nap, 0 nincs rögzítve, N nem díjköteles, I jelen, K kórház, H helyfoglal

CREATE TABLE befizetes (                              # -- egy hónaphoz több befizetés is tartozhat
  ID_BEFIZETES int unsigned NOT NULL auto_increment,
  ID_ELLATAS   int unsigned NOT NULL,
  OSSZEG       int NOT NULL,                          # -- Ft
  DATUM        date NOT NULL,
  MEGJEGYZES   varchar(255),
  ID_OPERATOR  int unsigned NOT NULL,                 # -- rögzítő
  DATUMIDO     timestamp NOT NULL default CURRENT_TIMESTAMP on update CURRENT_TIMESTAMP,
  PRIMARY KEY (ID_BEFIZETES),
  KEY (ID_ELLATAS),
  KEY (ID_OPERATOR),
  CONSTRAINT bef_e FOREIGN KEY (ID_ELLATAS)  REFERENCES ellatas  (ID_ELLATAS),   # -- pénzt tartalmazó hónap nem törölhető
  CONSTRAINT bef_o FOREIGN KEY (ID_OPERATOR) REFERENCES operator (ID_OPERATOR),
  CONSTRAINT bef_osszeg CHECK (OSSZEG <> 0)
) ENGINE=InnoDB;


# ------------------------------ operátorok ------------------------------------------------
# -- RENDSZER: automatikus műveletek végrehajtója, belépni nem tud (üres jelszó, nincs megerősítve)
insert into operator (LOGIN, NEV, PASSWORD, BEOSZTAS) values ('RENDSZER', 'RENDSZER', '', 'automatikus műveletek');
insert into operator (LOGIN, NEV, ADMIN_B, PASSWORD, BEOSZTAS) values ('bgondozo', 'B Gondozó', 'Y', md5('bgondozo'), 'adminisztrátor');
update operator set RATIFICAT = '' where LOGIN in ('admin', 'doki', 'apolo', 'bgondozo');


# ------------------------------ config ----------------------------------------------------
insert into config (FIELD, VALUE, DESCRIPTOR) values
('NAPIDIJ_SZAZALEK',         '60',  'Alap napidíj: havi nyugdíj × 12 ennyi %-a / az év napjai'),
('JELEN_SZORZO',             '100', 'Jelen (I) nap szorzója %-ban'),
('KUSZOB_NAP',               '40',  'Ettől az éves K/H naptól magasabb szorzó'),
('KORHAZ_SZORZO_ALATT',      '20',  'Kórházi (K) nap szorzója %, az év 1-39. K napján'),
('KORHAZ_SZORZO_FELETT',     '40',  'Kórházi (K) nap szorzója %, az év 40. K napjától'),
('HELYFOGLAL_SZORZO_ALATT',  '20',  'Helyfoglalt (H) nap szorzója %, az év 1-39. H napján'),
('HELYFOGLAL_SZORZO_FELETT', '60',  'Helyfoglalt (H) nap szorzója %, az év 40. H napjától'),
('KEREKITES_EGYSEG',         '1',   'Kerekítés egysége Ft-ban (alap és napi díj)'),
('CSV_ELVALASZTO',           ';',   'CSV export mezőelválasztó (magyar Excel: ;)');

insert into config (FIELD, VALUE, DESCRIPTOR)
  select 'RENDSZER_OPERATOR_ID', ID_OPERATOR, 'A RENDSZER operátor ID-ja (automatikus műveletek)' from operator where LOGIN = 'RENDSZER';


# ------------------------------ minta adatok rendbetétele ---------------------------------
# -- az 1-22. páciensnek van ellátás rekordja -> ellátott. A belépés napja az első hónap elején lévő 0-k után.
update paciensek p
  join (select ID_PACIENS,
               min(EV * 100 + HO) as ELSO,
               (select length(NAPOK) - length(trim(leading '0' from NAPOK)) from ellatas e2
                 where e2.ID_PACIENS = e.ID_PACIENS order by EV, HO limit 1) as ELOTTE
          from ellatas e group by ID_PACIENS) x on x.ID_PACIENS = p.ID_PACIENS
   set p.STATUS = 'ellátott',
       p.ELLATOTT_DATUM = makedate(x.ELSO div 100, 1) + interval (x.ELSO mod 100 - 1) month + interval x.ELOTTE day;

update paciensek
   set ELOGOND_DATUM  = ELLATOTT_DATUM - interval 14 day,
       VARAKOZO_DATUM = ELLATOTT_DATUM - interval 60 day
 where STATUS = 'ellátott';

insert into ellatasi_idoszak (ID_PACIENS, ELLATOTT_DATUM)
  select ID_PACIENS, ELLATOTT_DATUM from paciensek where STATUS = 'ellátott';

update ellatas e join ellatasi_idoszak i on i.ID_PACIENS = e.ID_PACIENS set e.ID_IDOSZAK = i.ID_IDOSZAK;

# -- 23-27: előgondozott, 28-30: távozott (korábbi, lezárt időszakkal), a többi várakozó, minden 7. sürgős
update paciensek set STATUS = 'előgondozott',
       VARAKOZO_DATUM = '2026-08-01' + interval ID_PACIENS day,
       ELOGOND_DATUM  = '2026-10-01' + interval ID_PACIENS day
 where ID_PACIENS between 23 and 27;

update paciensek set STATUS = 'távozott',
       VARAKOZO_DATUM = '2022-11-01', ELOGOND_DATUM = '2022-12-01',
       ELLATOTT_DATUM = '2023-01-01', TAVOZOTT_DATUM = '2023-12-31'
 where ID_PACIENS between 28 and 30;

insert into ellatasi_idoszak (ID_PACIENS, ELLATOTT_DATUM, TAVOZOTT_DATUM)
  select ID_PACIENS, ELLATOTT_DATUM, TAVOZOTT_DATUM from paciensek where STATUS = 'távozott';

update paciensek set VARAKOZO_DATUM = '2025-01-01' + interval (ID_PACIENS * 5) day
 where STATUS = 'várakozó';

update paciensek set SURGOS_VARAKOZO = 'Y' where STATUS = 'várakozó' and ID_PACIENS mod 7 = 0;

# -- NAPOK: a tanári minta számjegyeit (0 hiányzik, 1 jelen, 2 kórház, 3 helyfoglal) betűkre írjuk
update ellatas set NAPOK = replace(replace(replace(NAPOK, '1', 'I'), '2', 'K'), '3', 'H');

# -- első hónap belépés előtti napjai: N
update ellatas e join ellatasi_idoszak i on i.ID_IDOSZAK = e.ID_IDOSZAK
   set e.NAPOK = concat(repeat('N', day(i.ELLATOTT_DATUM) - 1), substring(e.NAPOK, day(i.ELLATOTT_DATUM)))
 where e.EV = year(i.ELLATOTT_DATUM) and e.HO = month(i.ELLATOTT_DATUM);

# -- a hónapban nem létező napok: '-'
update ellatas
   set NAPOK = concat(left(NAPOK, day(last_day(makedate(EV, 1) + interval (HO - 1) month))),
                      repeat('-', 31 - day(last_day(makedate(EV, 1) + interval (HO - 1) month))));

# -- maradék 0 a tanári minta szerint hiányzás -> H
update ellatas set NAPOK = replace(NAPOK, '0', 'H');

ALTER TABLE ellatas
  MODIFY ID_IDOSZAK int unsigned NOT NULL,
  DROP INDEX ID_PACIENS,                                           # -- a régi (ID_PACIENS, EV, HO) egyediség
  ADD UNIQUE KEY idoszak_ev_ho (ID_IDOSZAK, EV, HO),
  ADD CONSTRAINT ell_i  FOREIGN KEY (ID_IDOSZAK)           REFERENCES ellatasi_idoszak (ID_IDOSZAK),
  ADD CONSTRAINT ell_zo FOREIGN KEY (ZARTA_OPERATOR)       REFERENCES operator (ID_OPERATOR),
  ADD CONSTRAINT ell_mo FOREIGN KEY (MODOSITOTTA_OPERATOR) REFERENCES operator (ID_OPERATOR),
  ADD CONSTRAINT ell_ho    CHECK (HO between 1 and 12),
  ADD CONSTRAINT ell_napok CHECK (NAPOK regexp '(?-i)^[-0NIKH]{31}$');   # -- (?-i): kis- és nagybetű különbözik

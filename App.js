import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from './src/lib/supabase';
import { registerUser, loginUser, logoutUser, getCurrentUser } from './src/services/authService';
import { searchDrugs } from './src/services/drugService';

const BLUE = '#2F6FED';
const DARK = '#18365F';
const BORDER = '#DCE6F5';
const GREEN = '#2DB77A';
const RED = '#E95454';

function Logo({ small = false }) {
  return (
    <View style={styles.logoRow}>
      <View style={[styles.logoBox, small && styles.logoSmall]}>
        <Ionicons name="add" size={small ? 22 : 34} color={BLUE} />
        <View style={styles.logoAI}><Text style={[styles.logoAITxt, small && { fontSize: 8 }]}>AI</Text></View>
      </View>
      {!small && (
        <View>
          <Text style={styles.logoText}>MEDSAFE AI</Text>
          <Text style={styles.logoSub}>ผู้ช่วยสุขภาพอัจฉริยะด้วย AI</Text>
        </View>
      )}
    </View>
  );
}

function Button({ title, onPress, secondary = false, icon, loading = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || disabled}
      style={[styles.button, secondary && styles.buttonSecondary, (loading || disabled) && styles.buttonDisabled]}
    >
      {icon && <Ionicons name={icon} size={18} color={secondary ? BLUE : '#fff'} />}
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{loading ? 'กำลังทำงาน...' : title}</Text>
    </Pressable>
  );
}

function Splash({ go }) {
  return (
    <SafeAreaView style={styles.splash}>
      <View style={styles.splashCenter}>
        <Logo />
        <MaterialCommunityIcons name="human" size={155} color="#76A7F7" style={{ marginTop: 22 }} />
        <Text style={styles.splashTag}>สุขภาพของคุณ คือสิ่งสำคัญของเรา</Text>
      </View>
      <Pressable onPress={() => go('onboard1')} style={styles.skip}>
        <Text style={styles.muted}>เริ่มต้นใช้งาน →</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function Onboarding({ go, step }) {
  const data = {
    onboard1: ['AI ด้านสุขภาพ', 'ถามคำถามเกี่ยวกับสุขภาพ\nค้นหาข้อมูลทางการแพทย์\nด้วย AI อัจฉริยะ', 'human'],
    onboard2: ['ความปลอดภัยด้านยา', 'ตรวจสอบข้อมูลยาและ\nการใช้ยาอย่างปลอดภัย\nเพื่อสุขภาพที่ดีขึ้น', 'pill'],
    onboard3: ['เส้นทางปลอดภัยด้วย AI', 'วิเคราะห์เส้นทางและ\nความเสี่ยงโดย AI\nเพื่อการเดินทางที่ปลอดภัย', 'map-marker-path'],
  }[step];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.onboardTop}>
        <Text style={styles.step}>0{step.slice(-1)} / 3</Text>
        <Pressable onPress={() => go('login')}><Text style={styles.skipText}>ข้าม</Text></Pressable>
      </View>
      <View style={styles.onboardCenter}>
        <Text style={styles.heroTitle}>{data[0]}</Text>
        <Text style={styles.centerText}>{data[1]}</Text>
        <View style={styles.illustration}>
          <MaterialCommunityIcons name={data[2]} size={150} color="#6E9FF1" />
        </View>
      </View>
      <View>
        <View style={styles.dots}>
          {[1, 2, 3].map((n) => <View key={n} style={[styles.dot, step === `onboard${n}` && styles.dotActive]} />)}
        </View>
        <Button title={step === 'onboard3' ? 'เริ่มใช้งาน' : 'ถัดไป'} onPress={() => go(step === 'onboard1' ? 'onboard2' : step === 'onboard2' ? 'onboard3' : 'login')} />
      </View>
    </SafeAreaView>
  );
}

function Login({ go, onSubmit }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }
    setLoading(true);
    try {
      const result = await onSubmit({ email, password });
      if (result?.error) {
        setError(result.error.message || 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.auth}>
        <Logo />
        <Text style={styles.authTitle}>ยินดีต้อนรับกลับ</Text>
        <Text style={styles.muted}>เข้าสู่ระบบเพื่อใช้งาน MedSafe AI</Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          keyboardType="email-address"
          value={email}
          autoCapitalize="none"
          onChangeText={setEmail}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Pressable style={styles.forgot}><Text style={styles.link}>ลืมรหัสผ่าน?</Text></Pressable>
        <Button title="เข้าสู่ระบบ" onPress={handleSubmit} loading={loading} />
        <Text style={styles.or}>หรือ</Text>
        <Button title="ดำเนินการต่อด้วย Google" secondary icon="logo-google" onPress={() => go('home')} />
        <Pressable onPress={() => go('register')}>
          <Text style={styles.register}>ยังไม่มีบัญชี? <Text style={styles.link}>สมัครสมาชิก</Text></Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function Register({ go, onSubmit }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    if (!accepted) {
      setError('กรุณายอมรับเงื่อนไขการใช้งานก่อนสมัครสมาชิก');
      return;
    }
    if (password !== confirmPassword) {
      setError('ยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      const result = await onSubmit({ fullName, email, password, confirmPassword });
      if (result?.error) {
        setError(result.error.message || 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่');
      }

      if (result?.needsEmailConfirmation) {
        setError('สมัครสมาชิกสำเร็จ กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.auth}>
        <Logo />
        <Text style={styles.authTitle}>สร้างบัญชีใหม่</Text>

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        <Text style={styles.label}>ชื่อ-นามสกุล</Text>
        <TextInput style={styles.input} placeholder="กรอกชื่อ-นามสกุล" value={fullName} onChangeText={setFullName} />

        <Text style={styles.label}>อีเมล</Text>
        <TextInput
          style={styles.input}
          placeholder="example@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>รหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <Text style={styles.label}>ยืนยันรหัสผ่าน</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        <Pressable style={styles.checkRow} onPress={() => setAccepted((current) => !current)}>
          <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={20} color={BLUE} />
          <Text style={styles.muted}> ยอมรับเงื่อนไขการใช้งาน</Text>
        </Pressable>

        <Button title="สมัครสมาชิก" onPress={handleSubmit} loading={loading} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Home({ go, user, profile, onSearch }) {
  const [query, setQuery] = useState('');
  const cards = [
    ['AI ด้านสุขภาพ', 'ถามคำถามทางการแพทย์', 'meditation', 'chat'],
    ['ความปลอดภัยด้านยา', 'ตรวจสอบข้อมูลยาและความปลอดภัย', 'pill', 'drugs'],
    ['เส้นทางปลอดภัยด้วย AI', 'วิเคราะห์เส้นทางที่ปลอดภัย', 'map-marker-path', 'route'],
  ];
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ผู้ใช้งาน';

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.home}>
        <View style={styles.homeHeader}>
          <View>
            <Text style={styles.greeting}>สวัสดีค่ะ, {displayName} 👋</Text>
            <Text style={styles.muted}>วันนี้ให้ MedSafe AI ช่วยอะไรคุณ?</Text>
          </View>
          <View style={styles.avatar}><Text>{displayName.charAt(0).toUpperCase()}</Text></View>
        </View>

        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#8B9AB2" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => onSearch(query)}
            placeholder="ค้นหาข้อมูลยา อาการ..."
            returnKeyType="search"
            style={{ flex: 1 }}
          />
          {query ? (
            <Pressable accessibilityLabel="ล้างคำค้นหา" onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color="#8B9AB2" />
            </Pressable>
          ) : null}
        </View>

        {cards.map(([title, desc, icon, target]) => (
          <Pressable key={title} style={styles.featureCard} onPress={() => go(target)}>
            <View style={styles.iconCircle}><MaterialCommunityIcons name={icon} size={29} color={BLUE} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.muted}>{desc}</Text>
            </View>
            <Ionicons name="chevron-forward" size={21} color="#8CA0BC" />
          </Pressable>
        ))}

        <Text style={styles.sectionTitle}>การใช้งานล่าสุด</Text>
        <View style={styles.history}>
          <Ionicons name="medkit-outline" size={23} color={BLUE} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bold}>ค้นหายา</Text>
            <Text style={styles.muted}>ใช้ข้อมูลจากฐานข้อมูลยา</Text>
          </View>
          <Pressable onPress={() => go('drugs')}>
            <Text style={styles.link}>ค้นหา</Text>
          </Pressable>
        </View>
      </ScrollView>
      <BottomNav active="home" go={go} />
    </SafeAreaView>
  );
}

function MedicalAI({ go }) {
  const [msg, setMsg] = useState('');
  const [messages, setMessages] = useState([
    { me: false, text: 'สวัสดีค่ะ ฉันคือ MedSafe AI ผู้ช่วยด้านสุขภาพของคุณ มีอะไรให้ช่วยไหมคะ?' },
    { me: true, text: 'ถ้ารู้สึกตัวร้อนเหมือนจะเป็นไข้ ควรดูแลตัวเองอย่างไร?' },
    { me: false, text: 'พักผ่อนให้เพียงพอ ดื่มน้ำมากขึ้น และวัดอุณหภูมิเป็นระยะ หากมีไข้สูง หายใจลำบาก หรืออาการรุนแรงขึ้น ควรพบแพทย์ค่ะ' },
  ]);

  const send = () => {
    if (!msg.trim()) return;
    setMessages((currentMessages) => [...currentMessages, { me: true, text: msg.trim() }]);
    setMsg('');
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="AI ด้านสุขภาพ" go={go} />
      <ScrollView contentContainerStyle={styles.chat}>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.me ? styles.me : styles.ai]}>
            <Text style={m.me ? styles.meText : styles.text}>{m.text}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.composer}>
        <TextInput value={msg} onChangeText={setMsg} placeholder="พิมพ์คำถาม..." style={{ flex: 1 }} />
        <Pressable onPress={send} style={styles.send}>
          <Ionicons name="send" color="#fff" size={18} />
        </Pressable>
      </View>
      <BottomNav active="chat" go={go} />
    </SafeAreaView>
  );
}

function DrugSafety({ go, onSelectDrug, initialQuery = '' }) {
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const trimmedQuery = q.trim();

    console.log('[UI debug] search input:', trimmedQuery);

    if (!trimmedQuery) {
      setResults([]);
      setLoading(false);
      setError('');
      return () => {
        ignore = true;
      };
    }

    const fetchResults = async () => {
      setLoading(true);
      setError('');

      console.log('[UI debug] calling searchDrugs with:', trimmedQuery);
      const { data, error: searchError } = await searchDrugs(trimmedQuery);

      if (ignore) return;

      console.log('[UI debug] returned data length:', data?.length ?? 0);
      console.log('[UI debug] returned error:', searchError);

      if (searchError) {
        setResults([]);
        setError(searchError.message || 'ไม่สามารถค้นหายาได้ในขณะนี้');
      } else {
        setResults(data || []);
      }

      setLoading(false);
    };

    const timeout = setTimeout(fetchResults, 250);

    return () => {
      ignore = true;
      clearTimeout(timeout);
    };
  }, [q]);

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="ความปลอดภัยด้านยา" go={go} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>ค้นหายา</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#8B9AB2" />
          <TextInput value={q} onChangeText={setQ} placeholder="เช่น พาราเซตามอล หรือ paracetamol" style={{ flex: 1 }} />
        </View>

        {loading ? (
          <View style={{ marginTop: 16, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={BLUE} />
            <Text style={[styles.muted, { marginTop: 8 }]}>กำลังค้นหายา...</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorBox}>{error}</Text> : null}

        {!loading && !error && q.trim() && results.length === 0 ? (
          <Text style={[styles.muted, { marginTop: 14 }]}>ไม่พบยาที่ตรงกับคำค้นหา</Text>
        ) : null}

        {!loading && !q.trim() ? (
          <Text style={[styles.muted, { marginTop: 14 }]}>พิมพ์ชื่อยา ชื่อสารสำคัญ หรือรายละเอียดเป็นภาษาไทยได้</Text>
        ) : null}

        <Text style={styles.sectionTitle}>ผลการค้นหา</Text>
        {results.slice(0, 20).map((drug) => (
          <Pressable
            key={`${drug.drug_name}-${drug.source}`}
            style={styles.medicine}
            onPress={() => {
              onSelectDrug(drug);
              go('drugDetail');
            }}
          >
            <View style={[styles.medicineIcon, { backgroundColor: '#EAF2FF' }]}>
              <MaterialCommunityIcons name="pill" size={26} color={BLUE} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bold}>{drug.drug_name || 'ไม่ระบุชื่อยา'}</Text>
              <Text style={styles.muted}>{drug.drug_type || 'ไม่ระบุประเภทยา'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9AA8BA" />
          </Pressable>
        ))}

        <View style={styles.safeBox}>
          <Ionicons name="shield-checkmark" size={28} color={GREEN} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.bold}>ตรวจสอบการใช้ยาร่วมกัน</Text>
            <Text style={styles.muted}>ตรวจสอบการใช้ยาร่วมกันอย่างปลอดภัย</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav active="drugs" go={go} />
    </SafeAreaView>
  );
}

function DrugDetail({ go, selectedDrug }) {
  const drug = selectedDrug || {};
  const details = [
    ['ชื่อยา', drug.drug_name],
    ['ประเภทยา', drug.drug_type],
    ['รูปแบบยา', drug.dosage_form],
    ['สารสำคัญ', drug.active_ingredient],
    ['คำแนะนำ', drug.indication],
    ['เงื่อนไข', drug.restriction],
    ['คำเตือนและข้อควรระวัง', drug.precautions],
    ['รายละเอียด', drug.description],
    ['แหล่งข้อมูล', drug.source],
  ];

  return (
    <SafeAreaView style={styles.screen}>
      <Header title={drug.drug_name || 'ข้อมูลยา'} go={go} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.drugHero}>
          <View style={styles.bigPill}><MaterialCommunityIcons name="pill" size={55} color={BLUE} /></View>
          <Text style={styles.heroTitle}>{drug.drug_name || 'ไม่ระบุชื่อยา'}</Text>
          <Text style={styles.muted}>{drug.drug_type || 'ไม่ระบุประเภทยา'}</Text>
        </View>

        {details.map(([label, value]) => (
          <View key={label} style={styles.infoBlock}>
            <Text style={styles.cardTitle}>{label}</Text>
            <Text style={styles.muted}>{value || '—'}</Text>
          </View>
        ))}

        <Button title="กลับหน้าค้นหา" onPress={() => go('drugs')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function SafeRoute({ go }) {
  return (
    <SafeAreaView style={styles.screen}>
      <Header title="เส้นทางปลอดภัยด้วย AI" go={go} />
      <View style={styles.mapMock}>
        <View style={styles.mapGrid} />
        <View style={styles.routeLine} />
        <View style={[styles.pin, { top: '32%', left: '24%' }]}><Ionicons name="location" size={34} color={BLUE} /></View>
        <View style={[styles.pin, { top: '63%', right: '23%' }]}><Ionicons name="location" size={34} color={RED} /></View>
        <View style={styles.mapLabel}>
          <Text style={styles.bold}>เส้นทางแนะนำ</Text>
          <Text style={styles.muted}>วิเคราะห์ความเสี่ยงด้วย AI</Text>
        </View>
      </View>

      <View style={styles.routeCard}>
        <View style={styles.score}><Text style={styles.scoreNum}>87</Text><Text style={styles.score100}>/100</Text></View>
        <Text style={styles.risk}>● ความเสี่ยงต่ำ</Text>
        <Text style={styles.muted}>ใช้ข้อมูลสภาพถนน พื้นที่เสี่ยง และปัจจัยแวดล้อมเพื่อแนะนำเส้นทาง</Text>
        <Button title="วิเคราะห์เส้นทาง" onPress={() => {}} />
      </View>
      <BottomNav active="route" go={go} />
    </SafeAreaView>
  );
}

function Profile({ go, user, profile, onLogout }) {
  const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'ผู้ใช้งาน';
  const displayEmail = user?.email || profile?.email || 'example@email.com';

  return (
    <SafeAreaView style={styles.screen}>
      <Header title="โปรไฟล์" go={go} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.profile}>
          <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{displayName.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.heroTitle}>{displayName}</Text>
          <Text style={styles.muted}>{displayEmail}</Text>
        </View>

        {['ข้อมูลส่วนตัว', 'ประวัติการใช้งาน', 'รายการที่บันทึก', 'ตั้งค่า', 'เกี่ยวกับ MedSafe AI'].map((x) => (
          <Pressable key={x} style={styles.menu}>
            <Ionicons name="chevron-forward" size={20} color="#8EA0B8" />
            <Text style={{ flex: 1 }}>{x}</Text>
            <Ionicons name="person-outline" size={21} color={BLUE} />
          </Pressable>
        ))}

        <Button title="ออกจากระบบ" secondary onPress={onLogout} />
      </ScrollView>
      <BottomNav active="profile" go={go} />
    </SafeAreaView>
  );
}

function Header({ title, go }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={() => go('home')}><Ionicons name="arrow-back" size={24} color={DARK} /></Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <Ionicons name="notifications-outline" size={23} color={DARK} />
    </View>
  );
}

function BottomNav({ active, go }) {
  const items = [
    ['home', 'home', 'หน้าหลัก'],
    ['chat', 'chatbubble-ellipses-outline', 'AI'],
    ['drugs', 'medkit-outline', 'ยา'],
    ['route', 'location-outline', 'เส้นทาง'],
    ['profile', 'person-outline', 'โปรไฟล์'],
  ];

  return (
    <View style={styles.bottom}>
      {items.map(([id, icon, label]) => (
        <Pressable key={id} onPress={() => go(id)} style={styles.navItem}>
          <Ionicons name={icon} size={22} color={active === id ? BLUE : '#9AA8BA'} />
          <Text style={[styles.navText, active === id && { color: BLUE }]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('splash');
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [selectedDrug, setSelectedDrug] = useState(null);
  const [drugQuery, setDrugQuery] = useState('');

  const fetchProfile = async (currentUser) => {
    if (!currentUser?.id) return null;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .maybeSingle();

    if (error) {
      console.warn('fetchProfile error:', error.message);
      return null;
    }

    return data;
  };

  const go = (s) => setScreen(s);
  const searchFromHome = (query) => {
    setDrugQuery(query.trim());
    setScreen('drugs');
  };

  const handleLogin = async ({ email, password }) => {
    const response = await loginUser({ email, password });
    if (response.error) {
      return response;
    }

    const currentUser = response.data?.user;
    const profileData = await fetchProfile(currentUser);
    setUser(currentUser);
    setProfile(profileData);
    setScreen('home');
    return { data: response.data };
  };

  const handleRegister = async ({ fullName, email, password }) => {
    const response = await registerUser({ fullName, email, password });
    if (response.error) {
      return response;
    }

    const currentUser = response.data?.user;

    if (response.needsEmailConfirmation || !response.data?.session) {
      setUser(null);
      setProfile(null);
      setScreen('login');
      return {
        data: response.data,
        needsEmailConfirmation: true,
      };
    }

    const profileData = await fetchProfile(currentUser);
    setUser(currentUser);
    setProfile(profileData || { full_name: fullName, email });
    setScreen('home');
    return { data: response.data };
  };

  const handleLogout = async () => {
    const response = await logoutUser();
    if (response.error) {
      console.warn(response.error.message);
      return;
    }

    setUser(null);
    setProfile(null);
    setScreen('login');
  };

  useEffect(() => {
    let mounted = true;

    const initializeSession = async () => {
      const { data } = await getCurrentUser();
      if (!mounted) return;

      if (data) {
        setUser(data);
        const profileData = await fetchProfile(data);
        setProfile(profileData);
        setScreen('home');
      } else {
        setScreen('login');
      }

      setAuthLoading(false);
    };

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        const profileData = await fetchProfile(session.user);
        setProfile(profileData || { full_name: session.user.user_metadata?.full_name || '', email: session.user.email || '' });
        setScreen('home');
      } else {
        setUser(null);
        setProfile(null);
        setScreen('login');
      }

      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (authLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.auth}>
          <Logo />
          <View style={{ marginTop: 28, alignItems: 'center' }}>
            <ActivityIndicator size="large" color={BLUE} />
            <Text style={[styles.muted, { marginTop: 12, textAlign: 'center' }]}>กำลังตรวจสอบ session...</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const screens = {
    splash: <Splash go={go} />,
    onboard1: <Onboarding go={go} step="onboard1" />,
    onboard2: <Onboarding go={go} step="onboard2" />,
    onboard3: <Onboarding go={go} step="onboard3" />,
    login: <Login go={go} onSubmit={handleLogin} />,
    register: <Register go={go} onSubmit={handleRegister} />,
    home: <Home go={go} user={user} profile={profile} onSearch={searchFromHome} />,
    chat: <MedicalAI go={go} />,
    drugs: <DrugSafety go={go} onSelectDrug={setSelectedDrug} initialQuery={drugQuery} />,
    drugDetail: <DrugDetail go={go} selectedDrug={selectedDrug} />,
    route: <SafeRoute go={go} />,
    profile: <Profile go={go} user={user} profile={profile} onLogout={handleLogout} />,
  };

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FBFF" />
      {screens[screen]}
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: '#F8FBFF', alignItems: 'center', justifyContent: 'center', padding: 28 },
  splashCenter: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  splashTag: { color: '#6F89AB', marginTop: 10, fontSize: 12 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoBox: { width: 68, height: 68, borderRadius: 18, borderWidth: 3, borderColor: BLUE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', position: 'relative' },
  logoSmall: { width: 45, height: 45, borderRadius: 13, borderWidth: 2 },
  logoAI: { position: 'absolute', bottom: 7, right: 8, backgroundColor: '#fff' },
  logoAITxt: { fontWeight: '800', color: BLUE, fontSize: 12 },
  logoText: { fontSize: 28, fontWeight: '800', letterSpacing: 0.4, color: DARK },
  logoSub: { fontSize: 11, color: '#7E91AA', marginTop: 2 },
  screen: { flex: 1, backgroundColor: '#F8FBFF' },
  onboardTop: { flexDirection: 'row', justifyContent: 'space-between', padding: 18 },
  step: { fontSize: 11, color: '#8094AF' },
  skipText: { color: BLUE, fontWeight: '700' },
  onboardCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 25 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: DARK, textAlign: 'center' },
  centerText: { textAlign: 'center', color: '#7186A3', lineHeight: 22, marginTop: 10 },
  illustration: { height: 250, width: '100%', alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 16 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#D4DEEC' },
  dotActive: { width: 23, backgroundColor: BLUE },
  button: { height: 48, borderRadius: 12, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 12 },
  buttonSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  buttonTextSecondary: { color: BLUE },
  muted: { color: '#7D90AA', fontSize: 12, lineHeight: 18 },
  auth: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  authTitle: { fontSize: 25, fontWeight: '800', color: DARK, marginTop: 30, marginBottom: 5 },
  label: { fontSize: 12, color: '#526B8D', fontWeight: '700', marginTop: 18, marginBottom: 7 },
  input: { height: 45, borderWidth: 1, borderColor: BORDER, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, color: DARK },
  forgot: { alignSelf: 'flex-end', marginTop: 8 },
  link: { color: BLUE, fontWeight: '700' },
  or: { textAlign: 'center', color: '#98A7B9', marginVertical: 8 },
  register: { textAlign: 'center', marginTop: 20, color: '#7186A3' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  errorBox: { backgroundColor: '#FFEAEA', borderColor: '#F2B4B4', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginTop: 12, color: '#B12F2F', fontWeight: '600' },
  home: { padding: 18, paddingBottom: 100 },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 20, fontWeight: '800', color: DARK },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCE9FF', alignItems: 'center', justifyContent: 'center' },
  search: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: BORDER, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9, marginTop: 18 },
  featureCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E4ECF7', borderRadius: 15, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 11, shadowOpacity: 0.03, shadowRadius: 5 },
  iconCircle: { width: 47, height: 47, borderRadius: 13, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontWeight: '800', color: DARK, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: DARK, marginTop: 22, marginBottom: 10 },
  history: { backgroundColor: '#fff', borderRadius: 13, padding: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E4ECF7' },
  bold: { fontWeight: '700', color: DARK, fontSize: 13 },
  bottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 68, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E4ECF7', flexDirection: 'row', justifyContent: 'space-around', paddingTop: 8 },
  navItem: { alignItems: 'center', width: 65 },
  navText: { fontSize: 9, color: '#9AA8BA', marginTop: 2 },
  header: { height: 64, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5ECF6', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: DARK },
  chat: { padding: 16, paddingBottom: 20 },
  bubble: { maxWidth: '82%', padding: 12, borderRadius: 15, marginBottom: 10 },
  ai: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER },
  me: { alignSelf: 'flex-end', backgroundColor: BLUE },
  text: { color: DARK, fontSize: 13, lineHeight: 19 },
  meText: { color: '#fff', fontSize: 13, lineHeight: 19 },
  composer: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E5ECF6', padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  send: { width: 40, height: 40, borderRadius: 20, backgroundColor: BLUE, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 100 },
  medicine: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E3EAF5', borderRadius: 14, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  medicineIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  safeBox: { backgroundColor: '#ECFBF5', borderRadius: 14, padding: 14, flexDirection: 'row', marginTop: 15 },
  drugHero: { alignItems: 'center', paddingVertical: 20 },
  bigPill: { width: 100, height: 100, borderRadius: 28, backgroundColor: '#EEF5FF', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  infoBlock: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 13, padding: 15, marginBottom: 10 },
  mapMock: { flex: 1, margin: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: '#EAF2E7', position: 'relative' },
  mapGrid: { ...StyleSheet.absoluteFillObject, opacity: 0.35, backgroundColor: '#DCE8D6' },
  routeLine: { position: 'absolute', width: 230, height: 10, backgroundColor: '#6C9DF2', transform: [{ rotate: '-28deg' }], top: '52%', left: '18%', borderRadius: 10 },
  pin: { position: 'absolute' },
  mapLabel: { position: 'absolute', top: 15, left: 15, backgroundColor: '#fff', padding: 12, borderRadius: 12 },
  routeCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  score: { flexDirection: 'row', alignItems: 'baseline' },
  scoreNum: { fontSize: 34, fontWeight: '900', color: GREEN },
  score100: { fontSize: 15, color: '#7D90AA' },
  risk: { color: GREEN, fontWeight: '800', marginVertical: 5 },
  profile: { alignItems: 'center', paddingVertical: 15 },
  profileAvatar: { width: 86, height: 86, borderRadius: 43, backgroundColor: '#DCE9FF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { fontSize: 28, color: BLUE, fontWeight: '800' },
  menu: { height: 57, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EDF1F7', flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 15 },
});

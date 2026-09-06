import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { StatusBar } from 'expo-status-bar';
import {
  ChevronDown,
  BarChart3,
  Boxes,
  Menu,
  Minus,
  MoreHorizontal,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Percent,
  Plus,
  ReceiptText,
  Search,
  ShoppingBag,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
  Wifi,
  X,
} from 'lucide-react-native';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  Image,
  useColorScheme,
  useWindowDimensions,
  View,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { darkColors, lightColors, type SunhaColors } from '../src/design/tokens';
import { SunhaButton } from '../src/ui/sunha-button';
import type { CheckoutOrderInput } from '@sunha/contracts';
import { checkoutOrder, getCatalogSnapshot, getSellingPolicy } from '../src/auth/auth-client';
import { ApiError } from '../src/api/client';
import { getSessionContext } from '../src/auth/token-storage';
import { enqueueOperation, canChargeOffline } from '../src/offline/outbox';
import { syncPending } from '../src/offline/sync-client';
import { readLocalCart, saveLocalCart } from '../src/offline/local-db';

type Product = {
  id: string;
  itemId: string;
  unitId: string;
  name: string;
  price: number;
  category: string;
  color: string;
  abbreviation: string;
  imageUrl: string;
  modifierOptionIds: string[];
};

type CartLine = Product & { quantity: number };

const demoProducts: Product[] = [
  {
    id: '1', itemId: '1', unitId: '1',
    name: 'ກາເຟດຳ',
    price: 18000,
    category: 'ກາເຟ',
    color: '#D8B58C',
    abbreviation: 'ດຳ',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '2', itemId: '2', unitId: '2',
    name: 'ກາເຟນົມ',
    price: 22000,
    category: 'ກາເຟ',
    color: '#D7C39E',
    abbreviation: 'ນົມ',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '3', itemId: '3', unitId: '3',
    name: 'ລາເຕ້ເຢັນ',
    price: 25000,
    category: 'ກາເຟ',
    color: '#C9A36F',
    abbreviation: 'LT',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '4', itemId: '4', unitId: '4',
    name: 'ຊາຂຽວນົມ',
    price: 24000,
    category: 'ຊາ',
    color: '#AFC8A2',
    abbreviation: 'ຊາ',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '5', itemId: '5', unitId: '5',
    name: 'ຊາໝາກນາວ',
    price: 20000,
    category: 'ຊາ',
    color: '#D8D997',
    abbreviation: 'ຊນ',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '6', itemId: '6', unitId: '6',
    name: 'ນ້ຳສົ້ມ',
    price: 18000,
    category: 'ນ້ຳດື່ມ',
    color: '#F0B477',
    abbreviation: 'ສົ້ມ',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '7', itemId: '7', unitId: '7',
    name: 'ຄຣົວຊອງ',
    price: 19000,
    category: 'ເຂົ້າໜົມ',
    color: '#D8A46F',
    abbreviation: 'CR',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '8', itemId: '8', unitId: '8',
    name: 'ເຄັກຊັອກໂກແລັດ',
    price: 28000,
    category: 'ເຂົ້າໜົມ',
    color: '#A98273',
    abbreviation: 'CK',
    imageUrl: '', modifierOptionIds: [],
  },
  {
    id: '9', itemId: '9', unitId: '9',
    name: 'ນ້ຳດື່ມ',
    price: 7000,
    category: 'ນ້ຳດື່ມ',
    color: '#A7C9D9',
    abbreviation: 'H₂O',
    imageUrl: '', modifierOptionIds: [],
  },
];
void demoProducts;

const categories = ['ທັງໝົດ'];
const navigationItems = [
  { label: 'ຂາຍ', icon: ShoppingBag, route: '/' },
  { label: 'ໃບເສັດ', icon: ReceiptText, route: '/receipts' },
  { label: 'ສິນຄ້າ', icon: Package, route: '/items' },
  { label: 'ສະຕັອກ', icon: Boxes, route: '/stock' },
  { label: 'ພະນັກງານ', icon: Users, route: '/employees' },
  { label: 'Modifier', icon: SlidersHorizontal, route: '/modifiers' },
  { label: 'ພາສີ', icon: Percent, route: '/taxes' },
  { label: 'ລາຍງານ', icon: BarChart3, route: '/reports' },
  { label: 'ກະເງິນ', icon: ReceiptText, route: '/shifts' },
  { label: 'ຕັ້ງຄ່າ', icon: Settings, route: '/settings' },
  { label: 'Sync', icon: Wifi, route: '/sync' },
];

const formatLak = (amount: number) => `${amount.toLocaleString('en-US')} ₭`;

type ProductTileProps = Product & {
  colors: SunhaColors;
  onAdd: (id: string) => void;
  compact: boolean;
};

const ProductTile = memo(function ProductTile({
  id,
  name,
  price,
  color,
  abbreviation,
  imageUrl,
  colors,
  onAdd,
  compact,
}: ProductTileProps) {
  const handlePress = useCallback(() => onAdd(id), [id, onAdd]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatLak(price)}`}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.productTile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.76 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        compact && styles.productTileCompact,
      ]}
    >
      <View
        style={[
          styles.productVisual,
          { backgroundColor: color },
          compact && styles.productVisualCompact,
        ]}
      >
        {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.productImage} resizeMode="cover" /> : null}
        <View style={styles.productImageShade} />
        <Text style={styles.productAbbreviation}>{abbreviation}</Text>
        <View style={[styles.addBadge, { backgroundColor: colors.surface }]}>
          <Plus color={colors.text} size={17} strokeWidth={2.5} />
        </View>
      </View>
      <View style={styles.productCopy}>
        <Text numberOfLines={1} style={[styles.productName, { color: colors.text }]}>
          {name}
        </Text>
        <Text style={[styles.productPrice, { color: colors.textMuted }]}>{formatLak(price)}</Text>
      </View>
    </Pressable>
  );
});

type CartRowProps = CartLine & {
  colors: SunhaColors;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
};

const CartRow = memo(function CartRow({
  id,
  name,
  price,
  quantity,
  colors,
  onIncrement,
  onDecrement,
}: CartRowProps) {
  const increment = useCallback(() => onIncrement(id), [id, onIncrement]);
  const decrement = useCallback(() => onDecrement(id), [id, onDecrement]);

  return (
    <View style={[styles.cartRow, { borderBottomColor: colors.border }]}>
      <View style={styles.cartLineCopy}>
        <Text style={[styles.cartName, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.cartUnitPrice, { color: colors.textMuted }]}>
          {formatLak(price)} × {quantity}
        </Text>
      </View>
      <View style={[styles.stepper, { backgroundColor: colors.soft }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ຫຼຸດຈຳນວນ"
          hitSlop={8}
          onPress={decrement}
          style={styles.stepButton}
        >
          <Minus size={16} color={colors.text} strokeWidth={2.4} />
        </Pressable>
        <Text style={[styles.stepValue, { color: colors.text }]}>{quantity}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ເພີ່ມຈຳນວນ"
          hitSlop={8}
          onPress={increment}
          style={styles.stepButton}
        >
          <Plus size={16} color={colors.text} strokeWidth={2.4} />
        </Pressable>
      </View>
      <Text style={[styles.cartLineTotal, { color: colors.text }]}>
        {formatLak(price * quantity)}
      </Text>
    </View>
  );
});

function Sidebar({
  expanded,
  colors,
  onToggle,
  onNavigate,
}: {
  expanded: boolean;
  colors: SunhaColors;
  onToggle: () => void;
  onNavigate: (route: Href) => void;
}) {
  return (
    <View
      style={[
        styles.sidebar,
        {
          width: expanded ? 236 : 74,
          backgroundColor: colors.surface,
          borderRightColor: colors.border,
        },
      ]}
    >
      <View style={styles.sidebarStore}>
        <View style={[styles.sidebarLogo, { backgroundColor: colors.primary }]}>
          <Text style={[styles.brandLetter, { color: colors.onPrimary }]}>S</Text>
        </View>
        {expanded && (
          <View style={styles.sidebarStoreCopy}>
            <Text style={[styles.sidebarStoreName, { color: colors.text }]}>ຮ້ານກາເຟ ສຸນຫາ</Text>
            <Text style={[styles.sidebarRole, { color: colors.textMuted }]}>Owner · POS 1</Text>
          </View>
        )}
      </View>
      <View style={styles.sidebarItems}>
        {navigationItems.map(({ label, icon: Icon, route }, index) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onNavigate(route as Href)}
            style={[
              styles.sidebarItem,
              index === 0 && { backgroundColor: colors.soft },
              expanded ? styles.sidebarItemExpanded : styles.sidebarItemCollapsed,
            ]}
          >
            <Icon
              color={index === 0 ? colors.primary : colors.textMuted}
              size={21}
              strokeWidth={index === 0 ? 2.4 : 2}
            />
            {expanded && (
              <Text
                style={[
                  styles.sidebarItemText,
                  { color: index === 0 ? colors.primary : colors.text },
                ]}
              >
                {label}
              </Text>
            )}
          </Pressable>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ຂະຫຍາຍເມນູ"
        onPress={onToggle}
        style={[styles.sidebarToggle, { borderTopColor: colors.border }]}
      >
        {expanded ? (
          <PanelLeftClose color={colors.textMuted} size={20} />
        ) : (
          <PanelLeftOpen color={colors.textMuted} size={20} />
        )}
        {expanded && (
          <Text style={[styles.sidebarToggleText, { color: colors.textMuted }]}>ຫຍໍ້ເມນູ</Text>
        )}
      </Pressable>
    </View>
  );
}

export default function SaleScreen() {
  const router = useRouter();
  const scheme = useColorScheme();
  const colors = scheme === 'dark' ? darkColors : lightColors;
  const { width } = useWindowDimensions();
  const tablet = width >= 840;
  const compact = width < 390;
  const columns = tablet ? (width >= 1180 ? 4 : 3) : 2;
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryNames, setCategoryNames] = useState<string[]>(categories);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartVisible, setCartVisible] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const [paymentVisible, setPaymentVisible] = useState(false);
  const [paymentType, setPaymentType] = useState<'CASH' | 'MANUAL_QR' | 'BANK_TRANSFER' | 'CARD_MANUAL'>('CASH');
  const [tendered, setTendered] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [checkingOut, setCheckingOut] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [offlinePolicy, setOfflinePolicy] = useState<{ sellingDeviceCount: number; leaseExpiresAt: string | null }>({ sellingDeviceCount: 0, leaseExpiresAt: null });

  useEffect(() => {
    readLocalCart().then((saved) => { setCart(saved); setCartHydrated(true); }).catch(() => setCartHydrated(true));
    getSellingPolicy().then((policy) => setOfflinePolicy({ sellingDeviceCount: policy.sellingDeviceCount, leaseExpiresAt: policy.offlineLeaseExpiresAt ?? null })).catch(() => undefined);
    getCatalogSnapshot()
      .then((snapshot) => {
        const mapped = snapshot.items.flatMap((item) =>
          item.units.slice(0, 1).map((unit) => ({
            id: unit.id,
            itemId: item.id,
            unitId: unit.id,
            name: item.name,
            price: Number(unit.priceAmount),
            category: item.category?.name ?? 'ອື່ນໆ',
            color: item.category?.color ?? '#0F8B99',
            abbreviation: item.name.slice(0, 2),
            imageUrl: item.imageUrl ?? '',
            modifierOptionIds: [],
          })),
        );
        setProducts(mapped);
        setCategoryNames([categories[0] ?? 'ທັງໝົດ', ...[...new Set(mapped.map((item) => item.category))]]);
      })
      .catch(() => Alert.alert('ໂຫຼດສິນຄ້າບໍ່ສຳເລັດ', 'ກວດສອບອິນເຕີເນັດ ແລ້ວລອງໃໝ່'));
  }, []);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      const context = await getSessionContext();
      if (active && context.deviceId && context.employeeId) await syncPending(context.deviceId, context.employeeId);
    };
    void sync();
    const timer = setInterval(() => void sync(), 30_000);
    return () => { active = false; clearInterval(timer); };
  }, []);

  useEffect(() => { if (cartHydrated) saveLocalCart(cart).catch(() => undefined); }, [cart, cartHydrated]);

  const visibleProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return products.filter((product) => {
      const categoryMatch = activeCategory === categoryNames[0] || product.category === activeCategory;
      return categoryMatch && (!normalized || product.name.toLowerCase().includes(normalized));
    });
  }, [activeCategory, categoryNames, products, query]);

  const cartLines = useMemo<CartLine[]>(
    () =>
      products
        .filter((product) => cart[product.id])
        .map((product) => ({ ...product, quantity: cart[product.id] ?? 0 })),
    [cart, products],
  );
  const itemCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0);

  const addItem = useCallback((id: string) => {
    setCart((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }, []);
  const removeItem = useCallback((id: string) => {
    setCart((current) => {
      const next = { ...current };
      const quantity = (next[id] ?? 0) - 1;
      if (quantity <= 0) delete next[id];
      else next[id] = quantity;
      return next;
    });
  }, []);

  const checkout = useCallback(async () => {
    if (!cartLines.length || checkingOut) return;
    setCheckingOut(true);
    const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Date.now() + Math.random() * 16) % 16 | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    const input: CheckoutOrderInput = {
        clientOrderId: uuid(),
        lines: cartLines.map((line) => ({ itemId: line.itemId, unitId: line.unitId, quantity: String(line.quantity), modifierOptionIds: line.modifierOptionIds, note: '' })),
        discount: discountAmount ? { type: 'FIXED', amount: discountAmount } : undefined,
        paymentType,
        tenderedAmount: paymentType === 'CASH' ? { amount: tendered || '0', currency: 'LAK' } : undefined,
        paymentReference: paymentType === 'CASH' ? undefined : paymentReference || undefined,
        taxRateBasisPoints: 0,
        offline: false,
      };
    try {
      const result = await checkoutOrder(input);
      setCart({});
      setPaymentVisible(false);
      setCartVisible(false);
      setTendered('');
      setPaymentReference('');
      Alert.alert('ຮັບຊຳລະສຳເລັດ', `ເລກໃບເສັດ: ${result.receipts?.[0]?.number ?? 'ສຳເລັດ'}`);
    } catch (error) {
      if (!(error instanceof ApiError) && canChargeOffline(offlinePolicy.sellingDeviceCount, offlinePolicy.leaseExpiresAt)) {
        await enqueueOperation({ operationId: input.clientOrderId, type: 'CHECKOUT_ORDER', payload: { ...input, offline: true }, occurredAtDevice: new Date().toISOString() });
        setCart({}); setPaymentVisible(false); setCartVisible(false); setTendered(''); setPaymentReference('');
        Alert.alert('ບັນທຶກການຂາຍອອບລາຍແລ້ວ', 'ລະບົບຈະ sync ໃຫ້ອັດຕະໂນມັດເມື່ອອອນລາຍ');
      } else Alert.alert('ຮັບຊຳລະບໍ່ສຳເລັດ', error instanceof Error ? error.message : 'ກະລຸນາລອງໃໝ່');
    } finally {
      setCheckingOut(false);
    }
  }, [cartLines, checkingOut, discountAmount, offlinePolicy, paymentReference, paymentType, tendered]);

  const renderProduct: ListRenderItem<Product> = useCallback(
    ({ item }) => <ProductTile {...item} colors={colors} onAdd={addItem} compact={compact} />,
    [addItem, colors, compact],
  );

  const renderCartLine: ListRenderItem<CartLine> = useCallback(
    ({ item }) => (
      <CartRow {...item} colors={colors} onIncrement={addItem} onDecrement={removeItem} />
    ),
    [addItem, colors, removeItem],
  );

  const cartPanel = (
    <View
      style={[
        styles.cartPanel,
        !tablet && styles.cartPanelMobile,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.cartHeader}>
        <View style={styles.cartTitleRow}>
          <View style={[styles.ticketIcon, { backgroundColor: colors.soft }]}>
            <ReceiptText color={colors.primary} size={20} />
          </View>
          <View>
            <Text style={[styles.cartTitle, { color: colors.text }]}>ບິນປັດຈຸບັນ</Text>
            <Text style={[styles.cartSubtitle, { color: colors.textMuted }]}>
              ບິນ #001 · {itemCount} ລາຍການ
            </Text>
          </View>
        </View>
        {!tablet ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ປິດກະຕ່າ"
            hitSlop={10}
            onPress={() => setCartVisible(false)}
          >
            <X color={colors.textMuted} size={24} />
          </Pressable>
        ) : (
          <MoreHorizontal color={colors.textMuted} size={23} />
        )}
      </View>

      {cartLines.length ? (
        <FlashList data={cartLines} renderItem={renderCartLine} keyExtractor={(item) => item.id} />
      ) : (
        <View style={styles.emptyCart}>
          <ShoppingBag color={colors.textMuted} size={36} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>ບິນຍັງວ່າງ</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            ເລືອກສິນຄ້າເພື່ອເລີ່ມຂາຍ
          </Text>
        </View>
      )}

      <View style={[styles.cartSummary, { borderTopColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>ຍອດລວມ</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{formatLak(subtotal)}</Text>
        </View>
        <SunhaButton colors={colors} disabled={!itemCount} style={styles.chargeButton} onPress={() => setPaymentVisible(true)}>
          ຮັບຊຳລະ · {formatLak(subtotal)}
        </SunhaButton>
      </View>
    </View>
  );

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <View
        style={[
          styles.topBar,
          { backgroundColor: colors.background, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.brandGroup}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ເປີດເມນູ"
            onPress={() =>
              tablet ? setSidebarExpanded((value) => !value) : setDrawerVisible(true)
            }
            style={styles.menuButton}
          >
            {tablet ? (
              sidebarExpanded ? (
                <PanelLeftClose color={colors.text} size={18} />
              ) : (
                <PanelLeftOpen color={colors.text} size={18} />
              )
            ) : (
              <Menu color={colors.text} size={19} />
            )}
          </Pressable>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <Text style={[styles.brandLetter, { color: colors.onPrimary }]}>S</Text>
          </View>
          <View>
            <Text style={[styles.brandName, { color: colors.text }]}>Sunha</Text>
            <Pressable style={styles.storePicker}>
              <Text style={[styles.storeName, { color: colors.textMuted }]}>ຮ້ານກາເຟ ສຸນຫາ</Text>
              <ChevronDown color={colors.textMuted} size={14} />
            </Pressable>
          </View>
        </View>
        <View style={styles.topActions}>
          <View style={[styles.onlinePill, { backgroundColor: colors.soft }]}>
            <Wifi color={colors.success} size={15} />
            {tablet && <Text style={[styles.onlineText, { color: colors.text }]}>ອອນລາຍ</Text>}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ບັນຊີພະນັກງານ"
            style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <UserRound color={colors.text} size={19} />
          </Pressable>
        </View>
      </View>

      <View style={styles.workspace}>
        {tablet && (
          <Sidebar
            expanded={sidebarExpanded}
            colors={colors}
            onToggle={() => setSidebarExpanded((value) => !value)}
            onNavigate={(route) => router.push(route)}
          />
        )}
        <View style={styles.catalog}>
          <View style={[styles.catalogHeader, headerCompact && styles.catalogHeaderCompact]}>
            <View>
              {!headerCompact && (
                <Text style={[styles.screenEyebrow, { color: colors.primary }]}>ໜ້າຂາຍ</Text>
              )}
              {!headerCompact && (
                <Text style={[styles.screenTitle, { color: colors.text }]}>ເລືອກສິນຄ້າ</Text>
              )}
            </View>
            <View
              style={[
                styles.searchBox,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Search color={colors.textMuted} size={20} />
              <TextInput
                accessibilityLabel="ຄົ້ນຫາສິນຄ້າ"
                placeholder="ຄົ້ນຫາສິນຄ້າ..."
                placeholderTextColor={colors.textMuted}
                value={query}
                onChangeText={setQuery}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>
          </View>

          <View style={styles.categoryList}>
            <FlashList
              horizontal
              data={categoryNames}
              keyExtractor={(item) => item}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item === activeCategory;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setActiveCategory(item)}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: selected ? colors.primary : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        { color: selected ? colors.onPrimary : colors.text },
                      ]}
                    >
                      {item}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>

          <FlashList
            key={`products-${columns}`}
            data={visibleProducts}
            numColumns={columns}
            renderItem={renderProduct}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.productListContent}
            onScroll={(event) => setHeaderCompact(event.nativeEvent.contentOffset.y > 24)}
            scrollEventThrottle={16}
          />
        </View>
        {tablet && cartPanel}
      </View>

      {!tablet && (
        <View
          style={[
            styles.mobileDock,
            { backgroundColor: colors.surface, borderTopColor: colors.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`ເບິ່ງບິນ ${itemCount} ລາຍການ`}
            onPress={() => setCartVisible(true)}
            style={({ pressed }) => [
              styles.mobileCartButton,
              { backgroundColor: colors.primary, opacity: pressed ? 0.84 : 1 },
            ]}
          >
            <View style={[styles.countBadge, { backgroundColor: colors.onPrimary }]}>
              <Text style={[styles.countText, { color: colors.primary }]}>{itemCount}</Text>
            </View>
            <Text style={[styles.mobileCartLabel, { color: colors.onPrimary }]}>ເບິ່ງບິນ</Text>
            <Text style={[styles.mobileCartTotal, { color: colors.onPrimary }]}>
              {formatLak(subtotal)}
            </Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={!tablet && cartVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCartVisible(false)}
      >
        <Pressable
          style={[styles.modalScrim, { backgroundColor: colors.scrim }]}
          onPress={() => setCartVisible(false)}
        />
        <SafeAreaView
          style={[styles.mobileCartSheet, { backgroundColor: colors.surface }]}
          edges={['bottom']}
        >
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          {cartPanel}
        </SafeAreaView>
      </Modal>

      <Modal visible={paymentVisible} animationType="slide" transparent onRequestClose={() => setPaymentVisible(false)}>
        <Pressable style={[styles.modalScrim, { backgroundColor: colors.scrim }]} onPress={() => setPaymentVisible(false)} />
        <View style={[styles.paymentSheet, { backgroundColor: colors.surface }]}>
          <Text style={[styles.paymentTitle, { color: colors.text }]}>ຮັບຊຳລະ · {formatLak(subtotal)}</Text>
          <View style={styles.paymentTypes}>
            {(['CASH', 'MANUAL_QR', 'BANK_TRANSFER', 'CARD_MANUAL'] as const).map((type) => (
              <Pressable key={type} onPress={() => setPaymentType(type)} style={[styles.paymentType, { borderColor: paymentType === type ? colors.primary : colors.border, backgroundColor: paymentType === type ? colors.soft : colors.surface }]}>
                <Text style={[styles.paymentTypeText, { color: colors.text }]}>{type === 'CASH' ? 'ເງິນສົດ' : type === 'MANUAL_QR' ? 'QR (ບໍ່ຢືນຢັນ)' : type === 'BANK_TRANSFER' ? 'ໂອນເງິນ' : 'ບັດ'}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={discountAmount} onChangeText={setDiscountAmount} keyboardType="number-pad" placeholder="ສ່ວນຫຼຸດ (LAK)" placeholderTextColor={colors.textMuted} style={[styles.paymentInput, { color: colors.text, borderColor: colors.border }]} />
          {paymentType === 'CASH' ? <TextInput value={tendered} onChangeText={setTendered} keyboardType="number-pad" placeholder="ເງິນທີ່ຮັບ" placeholderTextColor={colors.textMuted} style={[styles.paymentInput, { color: colors.text, borderColor: colors.border }]} /> : <TextInput value={paymentReference} onChangeText={setPaymentReference} placeholder="ເລກອ້າງອີງ (ຖ້າມີ)" placeholderTextColor={colors.textMuted} style={[styles.paymentInput, { color: colors.text, borderColor: colors.border }]} />}
          {paymentType === 'CASH' && tendered ? <Text style={[styles.changeText, { color: colors.primary }]}>ເງິນທອນ: {formatLak(Math.max(0, Number(tendered) - subtotal))}</Text> : null}
          <SunhaButton colors={colors} disabled={checkingOut} onPress={checkout}>{checkingOut ? 'ກຳລັງບັນທຶກ...' : 'ຢືນຢັນຮັບຊຳລະ'}</SunhaButton>
        </View>
      </Modal>

      <Modal
        visible={!tablet && drawerVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setDrawerVisible(false)}
      >
        <View style={styles.drawerRoot}>
          <Pressable
            style={[styles.drawerScrim, { backgroundColor: colors.scrim }]}
            onPress={() => setDrawerVisible(false)}
          />
          <View
            style={[
              styles.drawer,
              { backgroundColor: colors.surface, borderRightColor: colors.border },
            ]}
          >
            <View style={styles.drawerHeader}>
              <View style={[styles.sidebarLogo, { backgroundColor: colors.primary }]}>
                <Text style={[styles.brandLetter, { color: colors.onPrimary }]}>S</Text>
              </View>
              <View>
                <Text style={[styles.sidebarStoreName, { color: colors.text }]}>
                  ຮ້ານກາເຟ ສຸນຫາ
                </Text>
                <Text style={[styles.sidebarRole, { color: colors.textMuted }]}>Owner · POS 1</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="ປິດເມນູ"
                hitSlop={10}
                onPress={() => setDrawerVisible(false)}
                style={styles.drawerClose}
              >
                <X color={colors.textMuted} size={21} />
              </Pressable>
            </View>
            <View style={styles.sidebarItems}>
              {navigationItems.map(({ label, icon: Icon, route }, index) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  onPress={() => {
                    setDrawerVisible(false);
                    router.push(route as Href);
                  }}
                  style={[
                    styles.sidebarItem,
                    index === 0 && { backgroundColor: colors.soft },
                    styles.sidebarItemExpanded,
                  ]}
                >
                  <Icon color={index === 0 ? colors.primary : colors.textMuted} size={21} />
                  <Text
                    style={[
                      styles.sidebarItemText,
                      { color: index === 0 ? colors.primary : colors.text },
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  topBar: {
    minHeight: 58,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  menuButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -2,
  },
  brandGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 11,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLetter: { fontFamily: 'NotoSansLao_700Bold', fontSize: 18, lineHeight: 25 },
  brandName: {
    fontFamily: 'NotoSansLao_700Bold',
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: -0.3,
  },
  storePicker: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  storeName: { fontFamily: 'NotoSansLao_400Regular', fontSize: 10, lineHeight: 14 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  onlinePill: {
    height: 38,
    borderRadius: 19,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 7,
  },
  onlineText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 12 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workspace: { flex: 1, flexDirection: 'row' },
  catalog: { flex: 1, paddingHorizontal: 14 },
  catalogHeader: { paddingTop: 11, paddingBottom: 9, gap: 9 },
  catalogHeaderCompact: { paddingTop: 6, paddingBottom: 6, gap: 0 },
  screenEyebrow: { fontFamily: 'NotoSansLao_700Bold', fontSize: 10, lineHeight: 15 },
  screenTitle: {
    fontFamily: 'NotoSansLao_700Bold',
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.5,
  },
  searchBox: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    minHeight: 42,
    fontFamily: 'NotoSansLao_400Regular',
    fontSize: 13,
    padding: 0,
  },
  categoryList: { height: 38, marginBottom: 9 },
  categoryChip: {
    minHeight: 33,
    paddingHorizontal: 13,
    marginRight: 7,
    borderWidth: 1,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 11, lineHeight: 16 },
  productListContent: { paddingBottom: 82 },
  productTile: {
    flex: 1,
    margin: 4,
    minHeight: 164,
    borderWidth: 1,
    borderRadius: 17,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  productTileCompact: { minHeight: 148 },
  productVisual: { minHeight: 100, flex: 1, alignItems: 'center', justifyContent: 'center' },
  productVisualCompact: { minHeight: 86 },
  productImage: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  productImageShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(20, 25, 22, 0.18)',
  },
  productAbbreviation: {
    color: '#FFFFFF',
    fontFamily: 'NotoSansLao_700Bold',
    fontSize: 20,
    zIndex: 1,
  },
  addBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productCopy: { padding: 10, gap: 1 },
  productName: { fontFamily: 'NotoSansLao_700Bold', fontSize: 12, lineHeight: 17 },
  productPrice: { fontFamily: 'NotoSansLao_400Regular', fontSize: 11, lineHeight: 16 },
  cartPanel: { width: 390, borderLeftWidth: 1, flex: 1 },
  cartPanelMobile: { width: '100%', borderLeftWidth: 0 },
  sidebar: { borderRightWidth: 1, paddingVertical: 17, justifyContent: 'space-between' },
  sidebarStore: {
    alignItems: 'center',
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: 'row',
    gap: 11,
  },
  sidebarLogo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sidebarStoreCopy: { flex: 1, gap: 1 },
  sidebarStoreName: { fontFamily: 'NotoSansLao_700Bold', fontSize: 12, lineHeight: 17 },
  sidebarRole: { fontFamily: 'NotoSansLao_400Regular', fontSize: 10, lineHeight: 14 },
  sidebarItems: { flex: 1, paddingTop: 14, gap: 4 },
  sidebarItem: { minHeight: 43, borderRadius: 13, alignItems: 'center', gap: 11 },
  sidebarItemExpanded: { flexDirection: 'row', paddingHorizontal: 15 },
  sidebarItemCollapsed: { justifyContent: 'center' },
  sidebarItemText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 12, lineHeight: 17 },
  sidebarToggle: {
    minHeight: 54,
    borderTopWidth: 1,
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  sidebarToggleText: { fontFamily: 'NotoSansLao_400Regular', fontSize: 12 },
  drawerRoot: { flex: 1, flexDirection: 'row' },
  drawerScrim: { flex: 1 },
  drawer: { width: 258, borderRightWidth: 1, padding: 16 },
  drawerHeader: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 0,
  },
  drawerClose: { marginLeft: 'auto' },
  cartHeader: {
    minHeight: 64,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  ticketIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cartTitle: { fontFamily: 'NotoSansLao_700Bold', fontSize: 16, lineHeight: 23 },
  cartSubtitle: { fontFamily: 'NotoSansLao_400Regular', fontSize: 12, lineHeight: 17 },
  cartRow: {
    minHeight: 72,
    marginHorizontal: 15,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cartLineCopy: { flex: 1, gap: 3 },
  cartName: { fontFamily: 'NotoSansLao_700Bold', fontSize: 14, lineHeight: 20 },
  cartUnitPrice: { fontFamily: 'NotoSansLao_400Regular', fontSize: 12, lineHeight: 17 },
  stepper: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderCurve: 'continuous',
  },
  stepButton: { width: 34, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 18, textAlign: 'center', fontFamily: 'NotoSansLao_700Bold', fontSize: 13 },
  cartLineTotal: { width: 76, textAlign: 'right', fontFamily: 'NotoSansLao_700Bold', fontSize: 13 },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  emptyTitle: { fontFamily: 'NotoSansLao_700Bold', fontSize: 17, marginTop: 8 },
  emptyText: { fontFamily: 'NotoSansLao_400Regular', fontSize: 13, textAlign: 'center' },
  cartSummary: { padding: 15, borderTopWidth: 1, gap: 11 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontFamily: 'NotoSansLao_400Regular', fontSize: 14 },
  summaryValue: { fontFamily: 'NotoSansLao_700Bold', fontSize: 20, letterSpacing: -0.5 },
  chargeButton: { width: '100%', minHeight: 52 },
  mobileDock: { borderTopWidth: 1, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 9 },
  mobileCartButton: {
    minHeight: 50,
    borderRadius: 16,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  countBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 13 },
  mobileCartLabel: { flex: 1, marginLeft: 11, fontFamily: 'NotoSansLao_700Bold', fontSize: 15 },
  mobileCartTotal: { fontFamily: 'NotoSansLao_700Bold', fontSize: 16 },
  modalScrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  mobileCartSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '80%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 9,
    marginBottom: 2,
  },
  paymentSheet: { position: 'absolute', left: 14, right: 14, bottom: 14, borderRadius: 22, padding: 18, gap: 12 },
  paymentTitle: { fontFamily: 'NotoSansLao_700Bold', fontSize: 18, lineHeight: 26 },
  paymentTypes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paymentType: { minHeight: 38, paddingHorizontal: 11, borderWidth: 1, borderRadius: 12, justifyContent: 'center' },
  paymentTypeText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 11 },
  paymentInput: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontFamily: 'NotoSansLao_400Regular', fontSize: 13 },
  changeText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 14 },
});

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Label } from '@shared/components/ui/label';
import { Input } from '@shared/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@shared/components/ui/radio-group';
import { Checkbox } from '@shared/components/ui/checkbox';
import { Button } from '@shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@shared/components/ui/card';
import { toast } from '@shared/components/ui/sonner';
import { hybridRuleService } from '@services/hybridRuleService';
import { logger } from '@shared/lib/logger';
import type { WorkType, AppHybridRule } from '@shared/types/shifts';
import { getErrorMessage } from '@services/serviceError';
import { useTranslation } from 'react-i18next';

type Props = {
  appId: string;
  appName: string;
  currentWorkType: WorkType;
  onWorkTypeChange: (workType: WorkType) => Promise<void>;
};

export function AppWorkTypeSettings({ appId, appName, currentWorkType, onWorkTypeChange }: Readonly<Props>) {
  const { t } = useTranslation();
  const [workType, setWorkType] = useState<WorkType>(currentWorkType);
  const [hybridRule, setHybridRule] = useState<Partial<AppHybridRule>>({
    min_hours_for_shift: 11,
    shift_rate: 150,
    fallback_to_orders: true,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadHybridRule = useCallback(async () => {
    setLoading(true);
    try {
      const rule = await hybridRuleService.getByAppId(appId);
      if (rule) {
        setHybridRule(rule);
      }
    } catch (error) {
      logger.error('Failed to load hybrid rule', error);
    } finally {
      setLoading(false);
    }
  }, [appId]);

  useEffect(() => {
    setWorkType(currentWorkType);
    if (currentWorkType === 'hybrid') {
      loadHybridRule().catch(() => {});
    }
  }, [currentWorkType, loadHybridRule]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onWorkTypeChange(workType);

      if (workType === 'hybrid') {
        await hybridRuleService.upsert({
          app_id: appId,
          min_hours_for_shift: hybridRule.min_hours_for_shift || 11,
          shift_rate: hybridRule.shift_rate || 150,
          fallback_to_orders: hybridRule.fallback_to_orders ?? true,
        });
      } else {
        try {
          await hybridRuleService.delete(appId);
        } catch {
          // ignore
        }
      }

      toast.success(t('settingsSavedSuccessfully'));
    } catch (error) {
      const message = getErrorMessage(error, t('settingsSaveFailed'));
      toast.error(t('errorSaving'), { description: message });
    } finally {
      setSaving(false);
    }
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('workTypeSettingsTitle', { name: appName })}</CardTitle>
        <CardDescription>
          {t('workTypeCalculationDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <Label>{t('workType')}</Label>
          <RadioGroup value={workType} onValueChange={(v) => setWorkType(v as WorkType)}>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="orders" id="orders" />
              <Label htmlFor="orders" className="cursor-pointer font-normal">
                <div>
                  <div className="font-medium">{t('ordersOnly')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('ordersOnlyDescription')}
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="shift" id="shift" />
              <Label htmlFor="shift" className="cursor-pointer font-normal">
                <div>
                  <div className="font-medium">{t('shiftsOnly')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('shiftsOnlyDescription')}
                  </div>
                </div>
              </Label>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              <RadioGroupItem value="hybrid" id="hybrid" />
              <Label htmlFor="hybrid" className="cursor-pointer font-normal">
                <div>
                  <div className="font-medium">{t('hybridWorkType')}</div>
                  <div className="text-xs text-muted-foreground">
                    {t('hybridWorkTypeDescription')}
                  </div>
                </div>
              </Label>
            </div>
          </RadioGroup>
        </div>

        {workType === 'hybrid' && (
          <div className="space-y-4 border-t pt-4">
            <h4 className="font-medium text-sm">{t('hybridShiftSettings')}</h4>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="animate-spin size-4" />
                {t('loading')}
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="minHours">{t('minimumShiftHours')}</Label>
                    <Input
                      id="minHours"
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={hybridRule.min_hours_for_shift ?? ''}
                      onChange={(e) =>
                        setHybridRule({ ...hybridRule, min_hours_for_shift: Number.parseFloat(e.target.value) })
                      }
                      placeholder="11"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('minimumShiftHoursHint')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="shiftRate">{t('dailyShiftRate')}</Label>
                    <Input
                      id="shiftRate"
                      type="number"
                      step="0.01"
                      min="0"
                      value={hybridRule.shift_rate ?? ''}
                      onChange={(e) =>
                        setHybridRule({ ...hybridRule, shift_rate: Number.parseFloat(e.target.value) })
                      }
                      placeholder="150"
                    />
                    <p className="text-xs text-muted-foreground">
                      {t('dailyShiftRateHint')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="fallback"
                    checked={hybridRule.fallback_to_orders ?? true}
                    onCheckedChange={(checked) =>
                      setHybridRule({ ...hybridRule, fallback_to_orders: checked as boolean })
                    }
                  />
                  <Label htmlFor="fallback" className="cursor-pointer font-normal text-sm">
                    {t('fallbackToOrders')}
                  </Label>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="animate-spin size-4 me-2" />}
            {t('saveSettings')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

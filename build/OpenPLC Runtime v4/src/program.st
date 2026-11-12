FUNCTION_BLOCK HighLevelAlarmFB
  VAR_INPUT
    AtOrAbove75 : BOOL;
  END_VAR
  VAR_OUTPUT
    Alarm : BOOL;
  END_VAR

  Alarm := AtOrAbove75;
END_FUNCTION_BLOCK

PROGRAM main
  VAR
    Phase : INT := 0;
    Tick : TON;
    AlarmLogic : HighLevelAlarmFB;
  END_VAR
  VAR
    AutoRun AT %MX0.0 : BOOL;
    StopCmd AT %MX0.1 : BOOL;
    FillValve AT %QX0.0 : BOOL;
    DrainValve AT %QX0.1 : BOOL;
    TankLevel AT %QW0 : INT := 20;
    CycleCount AT %QW1 : INT := 0;
    HighLevelAlarm AT %QX0.2 : BOOL;
  END_VAR

  (* Generate periodic simulation ticks *)
  Tick(IN := NOT Tick.Q, PT := T#500ms);

  (* 0 = Idle, 1 = Filling, 2 = Draining *)
  IF NOT AutoRun OR StopCmd THEN
      Phase := 0;
  ELSIF Phase = 0 THEN
      IF TankLevel >= 80 THEN
          Phase := 2;
      ELSE
          Phase := 1;
      END_IF;
  END_IF;

  (* Control the simulated valves *)
  FillValve := (Phase = 1) AND NOT StopCmd;
  DrainValve := (Phase = 2) AND NOT StopCmd;

  (* Simulate tank behaviour *)
  IF Tick.Q THEN
      IF FillValve AND TankLevel < 80 THEN
          TankLevel := TankLevel + 1;
      ELSIF DrainValve AND TankLevel > 20 THEN
          TankLevel := TankLevel - 1;
      END_IF;

      IF Phase = 1 AND TankLevel >= 80 THEN
          Phase := 2;
      ELSIF Phase = 2 AND TankLevel <= 20 THEN
          Phase := 1;
          CycleCount := CycleCount + 1;
      END_IF;
  END_IF;

  (* Execute the Ladder Logic alarm block *)
  AlarmLogic(AtOrAbove75 := TankLevel >= 75);
  HighLevelAlarm := AlarmLogic.Alarm;
END_PROGRAM


CONFIGURATION Config0

  RESOURCE Res0 ON PLC
    TASK task0(INTERVAL := T#20ms,PRIORITY := 1);
    PROGRAM instance0 WITH task0 : main;
  END_RESOURCE
END_CONFIGURATION
